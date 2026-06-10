export type ErrorType = 'preflight' | 'storage' | 'meta_publish';
export type ErrorStage =
  | 'preflight_validation'
  | 'supabase_storage_upload'
  | 'meta_publish_facebook'
  | 'meta_publish_instagram'
  | 'meta_publish_line'
  | 'youtube_publish'
  | 'tiktok_publish';

export interface PostResult {
  id: string;
  success: boolean;
  error?: string;
  error_type?: ErrorType;
  error_stage?: ErrorStage;
}

export async function postToInstagram(
  accessToken: string,
  igUserId: string,
  caption: string,
  imageUrls?: string[],
  videoUrl?: string,
): Promise<PostResult> {
  try {
    if (videoUrl && imageUrls?.length) {
      return {
        id: '',
        success: false,
        error: 'Instagram auto-post currently supports either image posts or one Reel per publish request',
        error_type: 'preflight',
        error_stage: 'preflight_validation',
      };
    }

    if (!imageUrls || imageUrls.length === 0) {
      if (!videoUrl) {
        return {
          id: '',
          success: false,
          error: 'Instagram requires at least one image or one video',
          error_type: 'preflight',
          error_stage: 'preflight_validation',
        };
      }
    }

    const normalizedImageUrls = imageUrls || [];

    // Helper to check processing status
    const waitForMediaProcessing = async (containerId: string, maxAttempts = 10, delayMs = 3000) => {
      let isReady = false;
      let attempt = 0;
      while (!isReady && attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        const statusRes = await fetch(
          `https://graph.facebook.com/v22.0/${containerId}?fields=status_code,status&access_token=${accessToken}`
        );
        const statusData = await statusRes.json();
        if (statusData.status_code === 'FINISHED') {
          isReady = true;
        } else if (statusData.status_code === 'ERROR') {
          throw new Error(statusData.status || 'Instagram failed to process the media container');
        }
        attempt++;
      }
      if (!isReady) throw new Error('Timeout waiting for Instagram media processing');
    };

    if (videoUrl) {
      const createRes = await fetch(
        `https://graph.facebook.com/v22.0/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            media_type: 'REELS',
            video_url: videoUrl,
            caption,
            share_to_feed: true,
            access_token: accessToken,
          }),
        },
      );
      const createData = await createRes.json();
      if (createData.error) {
        return {
          id: '',
          success: false,
          error: createData.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_instagram',
        };
      }

      await waitForMediaProcessing(createData.id, 30, 5000);

      const publishRes = await fetch(
        `https://graph.facebook.com/v22.0/${igUserId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: createData.id,
            access_token: accessToken,
          }),
        },
      );
      const publishData = await publishRes.json();
      if (publishData.error) {
        return {
          id: '',
          success: false,
          error: publishData.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_instagram',
        };
      }
      return { id: publishData.id, success: true };
    }

    // Single image post
    if (normalizedImageUrls.length === 1) {
      // Step 1: Create media container
      const createRes = await fetch(
        `https://graph.facebook.com/v22.0/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: normalizedImageUrls[0],
            caption,
            access_token: accessToken,
          }),
        },
      );
      const createData = await createRes.json();
      if (createData.error) {
        return {
          id: '',
          success: false,
          error: createData.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_instagram',
        };
      }

      await waitForMediaProcessing(createData.id);

      // Step 2: Publish
      const publishRes = await fetch(
        `https://graph.facebook.com/v22.0/${igUserId}/media_publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creation_id: createData.id,
            access_token: accessToken,
          }),
        },
      );
      const publishData = await publishRes.json();
      if (publishData.error) {
        return {
          id: '',
          success: false,
          error: publishData.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_instagram',
        };
      }
      return { id: publishData.id, success: true };
    }

    // Carousel (multiple images)
    const childIds: string[] = [];
    for (const url of normalizedImageUrls) {
      const res = await fetch(
        `https://graph.facebook.com/v22.0/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: url,
            is_carousel_item: true,
            access_token: accessToken,
          }),
        },
      );
      const data = await res.json();
      if (data.error) {
        return {
          id: '',
          success: false,
          error: data.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_instagram',
        };
      }
      childIds.push(data.id);
    }

    const carouselRes = await fetch(
      `https://graph.facebook.com/v22.0/${igUserId}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childIds,
          caption,
          access_token: accessToken,
        }),
      },
    );
    const carouselData = await carouselRes.json();
    if (carouselData.error) {
      return {
        id: '',
        success: false,
        error: carouselData.error.message,
        error_type: 'meta_publish',
        error_stage: 'meta_publish_instagram',
      };
    }

    await waitForMediaProcessing(carouselData.id);

    const publishRes = await fetch(
      `https://graph.facebook.com/v22.0/${igUserId}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: carouselData.id,
          access_token: accessToken,
        }),
      },
    );
    const publishData = await publishRes.json();
    if (publishData.error) {
      return {
        id: '',
        success: false,
        error: publishData.error.message,
        error_type: 'meta_publish',
        error_stage: 'meta_publish_instagram',
      };
    }
    return { id: publishData.id, success: true };
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_type: 'meta_publish',
      error_stage: 'meta_publish_instagram',
    };
  }
}
