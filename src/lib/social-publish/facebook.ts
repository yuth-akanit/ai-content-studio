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

export async function postToFacebookPage(
  pageAccessToken: string,
  pageExternalId: string,
  message: string,
  imageUrls?: string[],
  videoUrl?: string,
): Promise<PostResult> {
  try {
    if (videoUrl && imageUrls?.length) {
      return {
        id: '',
        success: false,
        error: 'Facebook auto-post currently supports either images or one video per post, not both',
        error_type: 'preflight',
        error_stage: 'preflight_validation',
      };
    }

    if (videoUrl) {
      const endpoint = `https://graph.facebook.com/v22.0/${pageExternalId}/videos`;
      const formData = new FormData();
      formData.append('access_token', pageAccessToken);
      formData.append('description', message);
      formData.append('file_url', videoUrl);

      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) {
        return {
          id: '',
          success: false,
          error: data.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_facebook',
        };
      }
      return { id: data.id || data.post_id || '', success: true };
    }

    // If no images, just post text
    if (!imageUrls || imageUrls.length === 0) {
      const endpoint = `https://graph.facebook.com/v22.0/${pageExternalId}/feed`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: pageAccessToken }),
      });
      const data = await res.json();
      if (data.error) {
        return {
          id: '',
          success: false,
          error: data.error.message,
          error_type: 'meta_publish',
          error_stage: 'meta_publish_facebook',
        };
      }
      return { id: data.id || data.post_id || '', success: true };
    }

    // Helper to upload a single photo (either data URI or HTTP URL)
    const uploadPhoto = async (imageUrl: string, published: boolean) => {
      const endpoint = `https://graph.facebook.com/v22.0/${pageExternalId}/photos`;
      const formData = new FormData();
      formData.append('access_token', pageAccessToken);
      formData.append('published', published.toString());
      if (published) formData.append('message', message);

      if (imageUrl.startsWith('data:')) {
        // Convert data URI to Blob
        const fetchRes = await fetch(imageUrl);
        const blob = await fetchRes.blob();
        formData.append('source', blob, 'image.jpg');
      } else {
        formData.append('url', imageUrl);
      }

      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      return data.id || data.post_id;
    };

    // If exactly 1 image
    if (imageUrls.length === 1) {
      const id = await uploadPhoto(imageUrls[0], true);
      return { id, success: true };
    }

    // If multiple images
    const mediaIds: string[] = [];
    for (const url of imageUrls) {
      const id = await uploadPhoto(url, false);
      mediaIds.push(id);
    }

    // Attach them to a single feed post
    const feedEndpoint = `https://graph.facebook.com/v22.0/${pageExternalId}/feed`;
    const attachedMedia = mediaIds.map((id) => ({ media_fbid: id }));
    const feedRes = await fetch(feedEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        attached_media: attachedMedia,
        access_token: pageAccessToken,
      }),
    });

    const feedData = await feedRes.json();
    if (feedData.error) {
      return {
        id: '',
        success: false,
        error: feedData.error.message,
        error_type: 'meta_publish',
        error_stage: 'meta_publish_facebook',
      };
    }

    return { id: feedData.id || feedData.post_id || '', success: true };
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_type: 'meta_publish',
      error_stage: 'meta_publish_facebook',
    };
  }
}
