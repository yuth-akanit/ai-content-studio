import crypto from 'crypto';
import type { ShortVideoPlatform } from './planner';
import type { RealVideoQualityGateV2 } from './real-video-quality-gate';
import type { ShortVideoPublishReadiness } from './publish-readiness';
import { hasPassedRealVideoQualityGateV2 } from './real-video-quality-gate';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { getSocialAccountTokenByPageId } from '@/lib/repositories/social-account-tokens';
import { uploadYouTubeShort } from '@/lib/social-publish/youtube';
import { postTikTokVideo } from '@/lib/social-publish/tiktok';
import { getValidYouTubeAccessToken } from '@/lib/oauth/youtube-oauth';
import { postToFacebookPage } from '@/lib/social-publish/facebook';
import { postToInstagram } from '@/lib/social-publish/instagram';

export type ShortVideoPublishMode = 'dry_run' | 'owner_manual_click';

export type ShortVideoPostedProof = {
  platform: ShortVideoPlatform;
  target_account: string;
  external_post_id: string;
  public_url: string;
  posted_at: string;
  posted_by: string;
  caption_checksum: string;
  video_asset_id: string;
  quality_gate_snapshot: RealVideoQualityGateV2;
};

export type ShortVideoPublishRequest = {
  platform: ShortVideoPlatform;
  target_account?: string;
  caption?: string;
  video_asset_id?: string;
  owner_confirmed?: boolean;
  publish_mode?: ShortVideoPublishMode;
  dry_run?: boolean;
  publish_readiness?: ShortVideoPublishReadiness;
  real_video_quality_gate_v2?: RealVideoQualityGateV2;
  manual_proof?: Partial<ShortVideoPostedProof> & { owner_recorded_proof?: boolean };
  // Extended fields
  target_id?: string;
  preview_id?: string;
  content_id?: string;
  video_url?: string;
  hashtags?: string[];
  cta?: string;
  idempotency_key?: string;
};

export type ShortVideoPublishResult = {
  ok: boolean;
  platform: ShortVideoPlatform;
  mode: 'dry_run' | 'blocked' | 'proof_recorded' | 'posted';
  adapter: string;
  publish_attempted: boolean;
  external_api_calls_performed: boolean;
  posted: boolean;
  posted_proof: ShortVideoPostedProof | null;
  blocked_reasons: string[];
  requirements: {
    owner_confirmed: boolean;
    publish_mode_owner_manual_click: boolean;
    real_social_publish_enabled: boolean;
    platform_enable_flag: boolean;
    real_video_quality_gate_v2_passed: boolean;
    publish_allowed: boolean;
  };
};

type PlatformAdapter = {
  platform: ShortVideoPlatform;
  name: string;
  enableFlag: string;
  dryRun: (request: ShortVideoPublishRequest) => ShortVideoPublishResult;
};

const ADAPTERS: Record<ShortVideoPlatform, PlatformAdapter> = {
  youtube_shorts: buildAdapter('youtube_shorts', 'youtube_shorts', 'YOUTUBE_SHORTS_PUBLISH_ENABLED'),
  facebook_reels: buildAdapter('facebook_reels', 'facebook_reels', 'FACEBOOK_REELS_PUBLISH_ENABLED'),
  instagram_reels: buildAdapter('instagram_reels', 'instagram_reels', 'INSTAGRAM_REELS_PUBLISH_ENABLED'),
  tiktok: buildAdapter('tiktok', 'tiktok', 'TIKTOK_PUBLISH_ENABLED'),
};

function checksum(value: string): string {
  return crypto.createHash('sha256').update(value || '').digest('hex');
}

function buildAdapter(platform: ShortVideoPlatform, name: string, enableFlag: string): PlatformAdapter {
  return {
    platform,
    name,
    enableFlag,
    dryRun(request) {
      return buildResult(request, name, 'dry_run', ['dry-run เท่านั้น: ไม่เรียก real platform publish API']);
    },
  };
}

function buildResult(
  request: ShortVideoPublishRequest,
  adapterName: string,
  mode: ShortVideoPublishResult['mode'],
  blockedReasons: string[],
  postedProof: ShortVideoPostedProof | null = null,
): ShortVideoPublishResult {
  const adapter = ADAPTERS[request.platform];
  const gatePassed = hasPassedRealVideoQualityGateV2(request.real_video_quality_gate_v2);
  const publishAllowed = request.publish_readiness?.publish_allowed === true;
  const requirements = {
    owner_confirmed: request.owner_confirmed === true,
    publish_mode_owner_manual_click: request.publish_mode === 'owner_manual_click',
    real_social_publish_enabled: process.env.REAL_SOCIAL_PUBLISH_ENABLED === 'true',
    platform_enable_flag: adapter ? process.env[adapter.enableFlag] === 'true' : false,
    real_video_quality_gate_v2_passed: gatePassed,
    publish_allowed: publishAllowed,
  };

  return {
    ok: mode === 'dry_run' || mode === 'proof_recorded' || mode === 'posted',
    platform: request.platform,
    mode,
    adapter: adapterName,
    publish_attempted: false,
    external_api_calls_performed: false,
    posted: mode === 'posted',
    posted_proof: postedProof,
    blocked_reasons: blockedReasons,
    requirements,
  };
}

function requirementBlockReasons(request: ShortVideoPublishRequest): string[] {
  const adapter = ADAPTERS[request.platform];
  if (!adapter) return ['unsupported_platform'];
  const reasons: string[] = [];
  if (request.owner_confirmed !== true) reasons.push('owner_confirmed=true required');
  if (request.publish_mode !== 'owner_manual_click') reasons.push('publish_mode=owner_manual_click required');
  if (process.env.REAL_SOCIAL_PUBLISH_ENABLED !== 'true') reasons.push('REAL_SOCIAL_PUBLISH_ENABLED=true required');
  if (process.env[adapter.enableFlag] !== 'true') reasons.push(`${adapter.enableFlag}=true required`);
  if (!hasPassedRealVideoQualityGateV2(request.real_video_quality_gate_v2)) reasons.push('real_video_quality_gate_v2 must pass');
  if (request.publish_readiness?.publish_allowed !== true) reasons.push('publish_readiness.publish_allowed=true required');
  return reasons;
}

function maybeRecordManualProof(request: ShortVideoPublishRequest): ShortVideoPostedProof | null {
  const proof = request.manual_proof;
  if (!proof?.owner_recorded_proof) return null;
  if (!proof.external_post_id || !proof.public_url || !proof.target_account || !request.real_video_quality_gate_v2) return null;
  return {
    platform: request.platform,
    target_account: String(proof.target_account),
    external_post_id: String(proof.external_post_id),
    public_url: String(proof.public_url),
    posted_at: String(proof.posted_at || new Date().toISOString()),
    posted_by: String(proof.posted_by || 'owner_manual_proof'),
    caption_checksum: checksum(request.caption || ''),
    video_asset_id: String(request.video_asset_id || proof.video_asset_id || ''),
    quality_gate_snapshot: request.real_video_quality_gate_v2,
  };
}

function buildVideoTitle(message: string, fallback = 'PAA Air Service Short') {
  const firstLine = message.split('\n').map((line) => line.trim()).find(Boolean);
  const title = firstLine || fallback;
  return title.length > 100 ? title.slice(0, 100) : title;
}

function getAbsoluteUrl(url: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.APP_BASE_URL || 'https://studio.paaair.online';
  return `${base.replace(/\/+$/, '')}/${url.replace(/^\/+/, '')}`;
}

async function verifyVideoUrlReachable(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (res.status === 200) return true;
    const resGet = await fetch(url, { method: 'GET' });
    return resGet.status === 200;
  } catch (err) {
    console.error('Video URL reachability check failed:', err);
    return false;
  }
}

// Global in-memory set to prevent double clicks (idempotency check)
const activePublishLocks = new Set<string>();

export async function publishShortVideoDistribution(request: ShortVideoPublishRequest): Promise<ShortVideoPublishResult> {
  const adapter = ADAPTERS[request.platform];
  if (!adapter) {
    return buildResult(request, 'unsupported', 'blocked', ['แพลตฟอร์มนี้ยังไม่รองรับ']);
  }

  // 1. Dry run bypass
  if (request.dry_run !== false) {
    return adapter.dryRun(request);
  }

  // 2. Manual proof bypass
  const manualProof = maybeRecordManualProof(request);
  if (manualProof) {
    return buildResult(request, adapter.name, 'proof_recorded', [], manualProof);
  }

  // 3. Server-side validations
  const blockedReasons: string[] = [];

  // Check owner_confirmed
  if (request.owner_confirmed !== true) {
    blockedReasons.push('owner_confirmed=true required');
  }

  // Check caption present
  const captionText = (request.caption || '').trim();
  if (!captionText) {
    blockedReasons.push('Caption is missing');
  }

  // Check quality gate passed
  const isGatePassed = hasPassedRealVideoQualityGateV2(request.real_video_quality_gate_v2);
  if (!isGatePassed) {
    blockedReasons.push('Real Video Quality Gate v2 must pass');
  }

  // Check video URL HTTP 200
  const finalVideoUrl = request.video_url || request.real_video_quality_gate_v2?.master_video_url || '';
  const absoluteVideoUrl = getAbsoluteUrl(finalVideoUrl);
  const isVideoReachable = await verifyVideoUrlReachable(absoluteVideoUrl);
  if (!isVideoReachable) {
    blockedReasons.push(`Video URL is not reachable (HTTP 200 checks failed)`);
  }

  // Check provider connected & target exists via existing database system
  const supabase = getSupabaseServerClient();
  let page: any = null;
  if (!request.target_id) {
    blockedReasons.push('Target page ID is required');
  } else {
    try {
      const { data, error } = await supabase
        .from('inbox_channels')
        .select('*')
        .eq('id', request.target_id)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        blockedReasons.push('Target page/account is not connected or active');
      } else {
        page = data;
      }
    } catch (err) {
      blockedReasons.push('Failed to load connection data');
    }
  }

  // 3b. Verify server-side credentials and DB-level idempotency
  if (page) {
    // Check provider credential exists server-side
    let credentialExists = false;
    try {
      if (request.platform === 'youtube_shorts' || request.platform === 'tiktok') {
        const providerName = request.platform === 'youtube_shorts' ? 'youtube' : 'tiktok';
        const accountToken = await getSocialAccountTokenByPageId(supabase, page.id, providerName);
        if (accountToken && accountToken.access_token) {
          credentialExists = true;
        }
      } else {
        const token = typeof page.meta?.access_token === 'string' ? page.meta.access_token : page.access_token || '';
        if (token) {
          credentialExists = true;
        }
      }
    } catch (err) {
      console.error('Error loading token for credential check:', err);
    }

    if (!credentialExists) {
      blockedReasons.push('ไม่พบโทเคนหรือข้อมูลการเชื่อมต่อของแพลตฟอร์มนี้บนระบบเซิร์ฟเวอร์');
    }

    // DB-level idempotency / duplicate check (avoid double posting)
    const isUuid = (val?: string) => {
      if (!val) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    };
    const lookupContentId = isUuid(request.content_id) ? request.content_id : isUuid(request.preview_id) ? request.preview_id : null;

    if (lookupContentId) {
      try {
        const { data: existingLogs, error: lookupError } = await supabase
          .from('post_logs')
          .select('id')
          .eq('content_id', lookupContentId)
          .eq('social_page_id', page.id)
          .eq('status', 'posted');

        if (!lookupError && existingLogs && existingLogs.length > 0) {
          blockedReasons.push('รายการนี้ได้ทำการโพสต์สำเร็จไปยังเพจ/บัญชีนี้แล้ว (ตรวจพบในระบบประวัติ)');
        }
      } catch (err) {
        console.error('Failed to perform DB idempotency check:', err);
      }
    }
  }

  if (blockedReasons.length > 0) {
    return buildResult(request, adapter.name, 'blocked', blockedReasons);
  }

  // 4. Idempotency Key Lock
  const lockKey = request.idempotency_key || `${request.target_id}-${checksum(captionText)}`;
  if (activePublishLocks.has(lockKey)) {
    return buildResult(request, adapter.name, 'blocked', ['ขออภัย ระบบกำลังประมวลผลการโพสต์รายการนี้อยู่ กรุณาอย่ากดย้ำ']);
  }
  activePublishLocks.add(lockKey);

  let success = false;
  let externalPostId = '';
  let publicUrl = '';
  let errorMessage = '';

  try {
    const token = typeof page.meta?.access_token === 'string' ? page.meta.access_token : page.access_token || '';

    if (request.platform === 'youtube_shorts') {
      const accountToken = await getSocialAccountTokenByPageId(supabase, page.id, 'youtube');
      if (!accountToken) throw new Error('Missing YouTube token');
      const youtubeAccessToken = await getValidYouTubeAccessToken(supabase, accountToken);
      const title = buildVideoTitle(captionText);
      const postResult = await uploadYouTubeShort({
        accessToken: youtubeAccessToken,
        videoUrl: absoluteVideoUrl,
        title,
        description: captionText,
        privacyStatus: 'unlisted', // Default status for Short Video Distribution posts
      });

      success = true;
      externalPostId = postResult.post_external_id;
      publicUrl = `https://youtube.com/shorts/${externalPostId}`;
    }
    else if (request.platform === 'tiktok') {
      const accountToken = await getSocialAccountTokenByPageId(supabase, page.id, 'tiktok');
      if (!accountToken) throw new Error('Missing TikTok token');

      const postResult = await postTikTokVideo({
        accessToken: accountToken.access_token,
        videoUrl: absoluteVideoUrl,
        caption: captionText,
        privacyLevel: 'SELF_ONLY', // Default privacy status for Short Video Distribution posts
      });

      success = true;
      externalPostId = postResult.post_external_id;
      publicUrl = `https://tiktok.com/@creator/video/${externalPostId}`; // TikTok URL format
    }
    else if (request.platform === 'facebook_reels') {
      const postResult = await postToFacebookPage(
        token,
        page.external_id,
        captionText,
        undefined,
        absoluteVideoUrl
      );

      if (postResult.success) {
        success = true;
        externalPostId = postResult.id;
        publicUrl = `https://facebook.com/${page.external_id}/videos/${externalPostId}`;
      } else {
        throw new Error(postResult.error || 'Facebook Reels post failed');
      }
    }
    else if (request.platform === 'instagram_reels') {
      const postResult = await postToInstagram(
        token,
        page.external_id,
        captionText,
        undefined,
        absoluteVideoUrl
      );

      if (postResult.success) {
        success = true;
        externalPostId = postResult.id;
        publicUrl = `https://instagram.com/p/${externalPostId}`;
      } else {
        throw new Error(postResult.error || 'Instagram Reels post failed');
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Unknown publish failure';
  } finally {
    activePublishLocks.delete(lockKey);
  }

  // 5. Log activity using existing pattern
  try {
    const isUuid = (val?: string) => {
      if (!val) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
    };

    const logRow = {
      content_id: isUuid(request.content_id) ? request.content_id : isUuid(request.preview_id) ? request.preview_id : null,
      social_page_id: page?.id || null,
      provider: page?.provider || request.platform,
      post_external_id: externalPostId || null,
      status: success ? 'posted' : 'failed',
      error_message: success ? null : (errorMessage || 'Unknown error'),
      comments_posted: 0,
      posted_at: new Date().toISOString(),
    };

    await supabase.from('post_logs').insert(logRow);
  } catch (logErr) {
    console.error('Failed to log post to database:', logErr);
  }

  if (success) {
    const postedProof: ShortVideoPostedProof = {
      platform: request.platform,
      target_account: page?.name || 'unknown',
      external_post_id: externalPostId,
      public_url: publicUrl,
      posted_at: new Date().toISOString(),
      posted_by: 'owner_manual_click',
      caption_checksum: checksum(captionText),
      video_asset_id: request.video_asset_id || request.real_video_quality_gate_v2?.analyzed_asset_id || '',
      quality_gate_snapshot: request.real_video_quality_gate_v2!,
    };

    const res = buildResult(request, adapter.name, 'posted', [], postedProof);
    res.posted = true;
    res.publish_attempted = true;
    res.external_api_calls_performed = true;
    return res;
  } else {
    return buildResult(request, adapter.name, 'blocked', [errorMessage || 'Publishing failed']);
  }
}

export const SHORT_VIDEO_PLATFORM_ADAPTERS = ADAPTERS;
