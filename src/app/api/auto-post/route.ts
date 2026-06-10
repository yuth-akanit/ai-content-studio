import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeImageUrls, normalizeVideoUrl } from '@/lib/server/media-storage';
import { getSocialAccountTokenByPageId } from '@/lib/repositories/social-account-tokens';
import { uploadYouTubeShort } from '@/lib/social-publish/youtube';
import { postTikTokVideo, type TikTokPrivacyLevel } from '@/lib/social-publish/tiktok';
import { getValidYouTubeAccessToken } from '@/lib/oauth/youtube-oauth';
import { postToFacebookPage, type PostResult, type ErrorType, type ErrorStage } from '@/lib/social-publish/facebook';
import { postToInstagram } from '@/lib/social-publish/instagram';

export const dynamic = 'force-dynamic';

interface PostRequest {
  content_id: string;
  page_ids?: string[];
  social_page_id?: string;
  message?: string;
  image_urls?: string[];
  video_url?: string | null;
  scheduled_post_id?: string;
  privacy_status?: string;
  youtube_privacy_status?: string;
  privacy_level?: string;
  tiktok_privacy_level?: string;
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

type YouTubePrivacyStatus = 'private' | 'unlisted' | 'public';

const YOUTUBE_PRIVACY_STATUSES = new Set<YouTubePrivacyStatus>([
  'private',
  'unlisted',
  'public',
]);

function normalizeYouTubePrivacyStatus(value?: string): YouTubePrivacyStatus | null {
  if (!value) return 'private';
  return YOUTUBE_PRIVACY_STATUSES.has(value as YouTubePrivacyStatus)
    ? value as YouTubePrivacyStatus
    : null;
}

function normalizeTikTokPrivacyLevel(value?: string): TikTokPrivacyLevel | null {
  if (!value) return 'SELF_ONLY';
  return TIKTOK_PRIVACY_LEVELS.has(value as TikTokPrivacyLevel) ? value as TikTokPrivacyLevel : null;
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
      privacy_status,
      youtube_privacy_status,
      privacy_level,
      tiktok_privacy_level,
    } = body;
    const pageIds = page_ids?.length ? page_ids : social_page_id ? [social_page_id] : [];
    const imageUrls = image_urls?.filter(Boolean);
    const videoUrl = video_url || undefined;
    const requestedYouTubePrivacyStatus = normalizeYouTubePrivacyStatus(youtube_privacy_status || privacy_status);
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

          if (!requestedYouTubePrivacyStatus) {
            return {
              page_id: page.id,
              page_name: page.name,
              provider: 'youtube',
              success: false,
              post_id: '',
              post_external_id: '',
              error: 'Invalid YouTube privacy_status',
              error_message: 'Invalid YouTube privacy_status',
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
            privacyStatus: requestedYouTubePrivacyStatus,
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
