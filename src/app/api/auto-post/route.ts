import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface PostRequest {
  content_id: string;
  page_ids: string[];
  message: string;
  image_urls?: string[];
}

async function postToFacebookPage(
  pageAccessToken: string,
  pageExternalId: string,
  message: string,
  imageUrls?: string[],
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    // If no images, just post text
    if (!imageUrls || imageUrls.length === 0) {
      const endpoint = `https://graph.facebook.com/v22.0/${pageExternalId}/feed`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, access_token: pageAccessToken }),
      });
      const data = await res.json();
      if (data.error) return { id: '', success: false, error: data.error.message };
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

    // If multiple images (max 2 as per UI limit, but supports more)
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
    if (feedData.error) return { id: '', success: false, error: feedData.error.message };

    return { id: feedData.id || feedData.post_id || '', success: true };
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function postToInstagram(
  accessToken: string,
  igUserId: string,
  caption: string,
  imageUrls?: string[],
): Promise<{ id: string; success: boolean; error?: string }> {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      return { id: '', success: false, error: 'Instagram requires at least one image' };
    }

    // Single image post
    if (imageUrls.length === 1) {
      // Step 1: Create media container
      const createRes = await fetch(
        `https://graph.facebook.com/v22.0/${igUserId}/media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrls[0],
            caption,
            access_token: accessToken,
          }),
        },
      );
      const createData = await createRes.json();
      if (createData.error) return { id: '', success: false, error: createData.error.message };

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
      if (publishData.error) return { id: '', success: false, error: publishData.error.message };
      return { id: publishData.id, success: true };
    }

    // Carousel (multiple images)
    const childIds: string[] = [];
    for (const url of imageUrls) {
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
      if (data.error) return { id: '', success: false, error: data.error.message };
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
    if (carouselData.error) return { id: '', success: false, error: carouselData.error.message };

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
    if (publishData.error) return { id: '', success: false, error: publishData.error.message };
    return { id: publishData.id, success: true };
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function postCommentToFacebook(
  pageAccessToken: string,
  postId: string,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v22.0/${postId}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: comment,
          access_token: pageAccessToken,
        }),
      },
    );

    const data = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: PostRequest = await request.json();
    const { content_id, page_ids, message, image_urls } = body;

    if (!content_id || !page_ids?.length || !message) {
      return NextResponse.json(
        { error: 'content_id, page_ids, and message are required' },
        { status: 400 },
      );
    }

    // Fetch the social pages from the database
    const { data: pages, error: pagesError } = await supabase
      .from('inbox_channels')
      .select('*')
      .in('id', page_ids);

    if (pagesError || !pages?.length) {
      return NextResponse.json(
        { error: 'No valid social pages found' },
        { status: 404 },
      );
    }

    // Fetch the generated content to get first_comment and suggested_comments
    const { data: content } = await supabase
      .from('generated_contents')
      .select('output_payload')
      .eq('id', content_id)
      .single();

    const allComments: string[] = [];
    // first_comment goes first (new schema)
    if (content?.output_payload?.first_comment) {
      allComments.push(content.output_payload.first_comment);
    }
    // then legacy suggested_comments
    if (content?.output_payload?.suggested_comments) {
      allComments.push(...content.output_payload.suggested_comments);
    }

    const results: {
      page_id: string;
      page_name: string;
      provider: string;
      success: boolean;
      post_id?: string;
      error?: string;
      comments_posted?: number;
    }[] = [];

    for (const page of pages) {
      const token = page.meta?.access_token || page.access_token;
      const isInstagram = page.meta?.is_instagram === true;

      if (isInstagram) {
        // Instagram Content Publishing API
        const postResult = await postToInstagram(
          token,
          page.external_id,
          message,
          image_urls,
        );

        results.push({
          page_id: page.id,
          page_name: page.name,
          provider: 'instagram',
          success: postResult.success,
          post_id: postResult.id,
          error: postResult.error,
          comments_posted: 0,
        });
      } else if (page.provider === 'facebook') {
        // Facebook Page Feed API
        const postResult = await postToFacebookPage(
          token,
          page.external_id,
          message,
          image_urls,
        );

        let commentsPosted = 0;

        if (postResult.success && postResult.id && allComments.length > 0) {
          for (const comment of allComments) {
            const commentResult = await postCommentToFacebook(
              token,
              postResult.id,
              comment,
            );
            if (commentResult.success) commentsPosted++;
          }
        }

        results.push({
          page_id: page.id,
          page_name: page.name,
          provider: page.provider,
          success: postResult.success,
          post_id: postResult.id,
          error: postResult.error,
          comments_posted: commentsPosted,
        });
      } else {
        results.push({
          page_id: page.id,
          page_name: page.name,
          provider: page.provider,
          success: false,
          error: `Provider "${page.provider}" auto-posting not yet supported`,
        });
      }
    }

    // Log the posting activity
    const { error: logError } = await supabase.from('post_logs').insert(
      results.map((r) => ({
        content_id,
        social_page_id: r.page_id,
        provider: r.provider,
        post_external_id: r.post_id || null,
        status: r.success ? 'posted' : 'failed',
        error_message: r.error || null,
        comments_posted: r.comments_posted || 0,
        posted_at: new Date().toISOString(),
      })),
    );

    if (logError) {
      console.warn('Failed to log post activity:', logError);
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      total: results.length,
      posted: successCount,
      failed: results.length - successCount,
      results,
    });
  } catch (error) {
    console.error('Auto-post error:', error);
    const message =
      error instanceof Error ? error.message : 'Auto-posting failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
