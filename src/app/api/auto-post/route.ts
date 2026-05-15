import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeImageUrls, normalizeVideoUrl } from '@/lib/server/media-storage';
import { getSocialAccountTokenByPageId } from '@/lib/repositories/social-account-tokens';
import { uploadYouTubeShort } from '@/lib/social/youtube-posting';
import { postTikTokVideo, type TikTokPrivacyLevel } from '@/lib/social/tiktok-posting';
import { getValidYouTubeAccessToken } from '@/lib/oauth/youtube-oauth';

export const dynamic = 'force-dynamic';

interface PostRequest {
  content_id: string;
  page_ids?: string[];
  social_page_id?: string;
  message?: string;
  image_urls?: string[];
  video_url?: string | null;
  scheduled_post_id?: string;
  privacy_level?: string;
  tiktok_privacy_level?: string;
}

type ErrorType = 'preflight' | 'storage' | 'meta_publish';
type ErrorStage =
  | 'preflight_validation'
  | 'supabase_storage_upload'
  | 'meta_publish_facebook'
  | 'meta_publish_instagram'
  | 'meta_publish_line'
  | 'youtube_publish'
  | 'tiktok_publish';

interface PostResult {
  id: string;
  success: boolean;
  error?: string;
  error_type?: ErrorType;
  error_stage?: ErrorStage;
}

type AutoPostProvider = 'facebook' | 'instagram' | 'line' | 'youtube' | 'tiktok' | string;

interface AutoPostPage {
  id: string;
  name: string;
  provider: string;
  external_id: string;
  access_token?: string | null;
  meta?: Record<string, unknown> | null;
}

function normalizeProvider(page: AutoPostPage): AutoPostProvider {
  if (page.meta?.is_instagram === true || page.provider === 'instagram') return 'instagram';
  if (page.provider === 'line_oa') return 'line';
  if (page.provider === 'youtube_shorts') return 'youtube';
  return page.provider;
}

function buildVideoTitle(message: string, fallback = 'PAA Air Service Short') {
  const firstLine = message.split('\n').map((line) => line.trim()).find(Boolean);
  const title = firstLine || fallback;
  return title.length > 100 ? title.slice(0, 100) : title;
}

function normalizeProviderErrorStage(provider: AutoPostProvider): ErrorStage {
  if (provider === 'instagram') return 'meta_publish_instagram';
  if (provider === 'line') return 'meta_publish_line';
  if (provider === 'youtube') return 'youtube_publish';
  if (provider === 'tiktok') return 'tiktok_publish';
  return 'meta_publish_facebook';
}

const TIKTOK_PRIVACY_LEVELS = new Set<TikTokPrivacyLevel>([
  'SELF_ONLY',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'PUBLIC_TO_EVERYONE',
]);

function normalizeTikTokPrivacyLevel(value?: string): TikTokPrivacyLevel | null {
  if (!value) return 'SELF_ONLY';
  return TIKTOK_PRIVACY_LEVELS.has(value as TikTokPrivacyLevel) ? value as TikTokPrivacyLevel : null;
}

async function postToFacebookPage(
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

async function postToInstagram(
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

async function postToLineOA(
  accessToken: string,
  message: string,
  imageUrls?: string[],
  videoUrl?: string,
): Promise<PostResult> {
  try {
    if (videoUrl) {
      return {
        id: '',
        success: false,
        error: 'LINE OA broadcast video auto-post is not supported in this flow yet',
        error_type: 'preflight',
        error_stage: 'preflight_validation',
      };
    }

    type LineMessage =
      | { type: 'image'; originalContentUrl: string; previewImageUrl: string }
      | { type: 'text'; text: string };

    const messages: LineMessage[] = [];

    // Add images first (max 4 to leave room for text)
    if (imageUrls && imageUrls.length > 0) {
      for (const url of imageUrls.slice(0, 4)) {
        messages.push({
          type: 'image',
          originalContentUrl: url,
          previewImageUrl: url, // For simplicity using same URL
        });
      }
    }

    // Add the main text message
    // Note: LINE text messages have a 5000 character limit
    messages.push({
      type: 'text',
      text: message.slice(0, 5000),
    });

    const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ messages: messages.slice(0, 5) }), // LINE limit is 5 per broadcast
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        id: '',
        success: false,
        error: data.message || `LINE API Error (${response.status})`,
        error_type: 'meta_publish',
        error_stage: 'meta_publish_line',
      };
    }

    return { id: 'line-broadcast', success: true };
  } catch (error) {
    return {
      id: '',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      error_type: 'meta_publish',
      error_stage: 'meta_publish_line',
    };
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  try {
    const body: PostRequest = await request.json();
    const {
      content_id,
      page_ids,
      social_page_id,
      message,
      image_urls,
      video_url,
      scheduled_post_id,
      privacy_level,
      tiktok_privacy_level,
    } = body;
    const pageIds = page_ids?.length ? page_ids : social_page_id ? [social_page_id] : [];
    const imageUrls = image_urls?.filter(Boolean);
    const videoUrl = video_url || undefined;
    const requestedTikTokPrivacyLevel = normalizeTikTokPrivacyLevel(tiktok_privacy_level || privacy_level);

    if (!content_id || !pageIds.length || !message?.trim()) {
      return NextResponse.json(
        {
          error: 'content_id, page_ids, and message are required',
          error_type: 'preflight',
          error_stage: 'preflight_validation',
        },
        { status: 400 },
      );
    }

    if (imageUrls?.length && videoUrl) {
      return NextResponse.json(
        {
          error: 'Please send either image_urls or video_url for this publish request, not both',
          error_type: 'preflight',
          error_stage: 'preflight_validation',
        },
        { status: 400 },
      );
    }

    let publicImageUrls: string[] | undefined;
    let publicVideoUrl: string | undefined;

    try {
      publicImageUrls = await normalizeImageUrls(supabase, imageUrls);
      publicVideoUrl = await normalizeVideoUrl(supabase, videoUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Storage upload failed';
      return NextResponse.json(
        {
          error: message,
          error_type: 'storage',
          error_stage: 'supabase_storage_upload',
        },
        { status: 500 },
      );
    }

    // Fetch the social pages from the database
    const { data: pages, error: pagesError } = await supabase
      .from('inbox_channels')
      .select('*')
      .in('id', pageIds);

    if (pagesError || !pages?.length) {
      return NextResponse.json(
        {
          error: 'No valid social pages found',
          error_type: 'preflight',
          error_stage: 'preflight_validation',
        },
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

    const results = await Promise.all((pages as AutoPostPage[]).map(async (page) => {
      const token = typeof page.meta?.access_token === 'string' ? page.meta.access_token : page.access_token || '';
      const provider = normalizeProvider(page);

      try {
        if (provider === 'instagram') {
          const postResult = await postToInstagram(
            token,
            page.external_id,
            message,
            publicImageUrls,
            publicVideoUrl,
          );

          return {
            page_id: page.id,
            page_name: page.name,
            provider: 'instagram',
            success: postResult.success,
            post_id: postResult.id,
            post_external_id: postResult.id,
            error: postResult.error,
            error_message: postResult.error,
            error_type: postResult.error_type,
            error_stage: postResult.error_stage,
            comments_posted: 0,
          };
        } else if (provider === 'facebook') {
          const postResult = await postToFacebookPage(
            token,
            page.external_id,
            message,
            publicImageUrls,
            publicVideoUrl,
          );

          let commentsPosted = 0;

          if (postResult.success && postResult.id && allComments.length > 0) {
            // Comments can still be sequential within a page if order matters, 
            // but we could also parallelize them if needed.
            for (const comment of allComments) {
              const commentResult = await postCommentToFacebook(
                token,
                postResult.id,
                comment,
              );
              if (commentResult.success) commentsPosted++;
            }
          }

          return {
            page_id: page.id,
            page_name: page.name,
            provider: page.provider,
            success: postResult.success,
            post_id: postResult.id,
            post_external_id: postResult.id,
            error: postResult.error,
            error_message: postResult.error,
            error_type: postResult.error_type,
            error_stage: postResult.error_stage,
            comments_posted: commentsPosted,
          };
        } else if (provider === 'line') {
          const postResult = await postToLineOA(
            token,
            message,
            publicImageUrls,
            publicVideoUrl,
          );

          return {
            page_id: page.id,
            page_name: page.name,
            provider: 'line',
            success: postResult.success,
            post_id: postResult.id,
            post_external_id: postResult.id,
            error: postResult.error,
            error_message: postResult.error,
            error_type: postResult.error_type,
            error_stage: postResult.error_stage,
            comments_posted: 0,
          };
        } else if (provider === 'youtube') {
          if (!publicVideoUrl) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'youtube',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'YouTube posting requires video_url',
              error_message: 'YouTube posting requires video_url',
              error_type: 'preflight' as ErrorType,
              error_stage: 'preflight_validation' as ErrorStage,
              comments_posted: 0,
            };
          }

          const accountToken = await getSocialAccountTokenByPageId(supabase, page.id, 'youtube');
          if (!accountToken) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'youtube',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'Missing YouTube token',
              error_message: 'Missing YouTube token',
              error_type: 'preflight' as ErrorType,
              error_stage: 'preflight_validation' as ErrorStage,
              comments_posted: 0,
            };
          }

          const youtubeAccessToken = await getValidYouTubeAccessToken(supabase, accountToken);
          const postResult = await uploadYouTubeShort({
            accessToken: youtubeAccessToken,
            videoUrl: publicVideoUrl,
            title: buildVideoTitle(message),
            description: message,
            privacyStatus: 'private',
          });

          return {
            page_id: page.id,
            page_name: page.name,
            provider: 'youtube',
            success: postResult.success,
            post_id: postResult.post_external_id,
            post_external_id: postResult.post_external_id,
            comments_posted: 0,
          };
        } else if (provider === 'tiktok') {
          if (!publicVideoUrl) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'tiktok',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'TikTok posting requires video_url',
              error_message: 'TikTok posting requires video_url',
              error_type: 'preflight' as ErrorType,
              error_stage: 'preflight_validation' as ErrorStage,
              comments_posted: 0,
            };
          }

          if (!requestedTikTokPrivacyLevel) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'tiktok',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'Invalid TikTok privacy_level',
              error_message: 'Invalid TikTok privacy_level',
              error_type: 'preflight' as ErrorType,
              error_stage: 'preflight_validation' as ErrorStage,
              comments_posted: 0,
            };
          }

          if (
            requestedTikTokPrivacyLevel === 'PUBLIC_TO_EVERYONE' &&
            process.env.TIKTOK_ALLOW_PUBLIC_DIRECT_POST !== 'true'
          ) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'tiktok',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'TikTok public direct post is disabled',
              error_message: 'TikTok public direct post is disabled',
              error_type: 'preflight' as ErrorType,
              error_stage: 'preflight_validation' as ErrorStage,
              comments_posted: 0,
            };
          }

          const accountToken = await getSocialAccountTokenByPageId(supabase, page.id, 'tiktok');
          if (!accountToken) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'tiktok',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'Missing TikTok token',
              error_message: 'Missing TikTok token',
              error_type: 'preflight' as ErrorType,
              error_stage: 'preflight_validation' as ErrorStage,
              comments_posted: 0,
            };
          }

          const postResult = await postTikTokVideo({
            accessToken: accountToken.access_token,
            videoUrl: publicVideoUrl,
            caption: message,
            privacyLevel: requestedTikTokPrivacyLevel,
          });

          return {
            page_id: page.id,
            page_name: page.name,
            provider: 'tiktok',
            success: postResult.success,
            post_id: postResult.post_external_id,
            post_external_id: postResult.post_external_id,
            comments_posted: 0,
          };
        } else {
          return {
            page_id: page.id,
            page_name: page.name,
            provider: page.provider,
            success: false,
            post_id: '',
            post_external_id: '',
            error: `Provider "${page.provider}" auto-posting not yet supported`,
            error_message: `Provider "${page.provider}" auto-posting not yet supported`,
            error_type: 'preflight',
            error_stage: 'preflight_validation',
            comments_posted: 0,
          };
        }
      } catch (err) {
        return {
          page_id: page.id,
          page_name: page.name,
          provider,
          success: false,
          post_id: '',
          post_external_id: '',
          error: err instanceof Error ? err.message : 'Unknown error',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          error_type: 'meta_publish',
          error_stage: normalizeProviderErrorStage(provider),
          comments_posted: 0,
        };
      }
    }));

    const logRows = results.map((r) => ({
        content_id,
        social_page_id: r.page_id,
        provider: r.provider,
        post_external_id: r.post_external_id || r.post_id || null,
        status: r.success ? 'posted' : 'failed',
        error_message: r.error_message || r.error || null,
        comments_posted: r.comments_posted || 0,
        posted_at: new Date().toISOString(),
    }));

    const { data: insertedLogs, error: logError } = await supabase
      .from('post_logs')
      .insert(logRows)
      .select('id,social_page_id,status,provider');

    if (logError) {
      console.warn('Failed to log post activity:', logError);
    }

    const logIdBySocialPage = new Map<string, string>();
    for (const log of insertedLogs || []) {
      if (log.social_page_id && log.id) {
        logIdBySocialPage.set(log.social_page_id, log.id);
      }
    }

    const resultsWithLogs = results.map((r) => ({
      ...r,
      social_page_id: r.page_id,
      post_log_id: logIdBySocialPage.get(r.page_id) || null,
      status: r.success ? 'posted' : 'failed',
      post_external_id: r.post_external_id || r.post_id || null,
      error_message: r.error_message || r.error || null,
      platform: r.provider,
    }));

    const postLogIds = resultsWithLogs
      .map((r) => r.post_log_id)
      .filter((id): id is string => Boolean(id));
    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      ok: successCount > 0,
      success: successCount > 0,
      scheduled_post_id,
      total: results.length,
      posted: successCount,
      failed: results.length - successCount,
      post_log_id: postLogIds.length === 1 ? postLogIds[0] : undefined,
      post_log_ids: postLogIds,
      error_type: successCount > 0 ? undefined : results.find((r) => !r.success)?.error_type,
      error_stage: successCount > 0 ? undefined : results.find((r) => !r.success)?.error_stage,
      results: resultsWithLogs,
    });
  } catch (error) {
    console.error('Auto-post error:', error);
    const message =
      error instanceof Error ? error.message : 'Auto-posting failed';
    return NextResponse.json(
      {
        error: message,
        error_type: 'meta_publish',
        error_stage: 'meta_publish_facebook',
      },
      { status: 500 },
    );
  }
}
