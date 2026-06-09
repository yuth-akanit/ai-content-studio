import crypto from 'node:crypto';
import type { ShortVideoPlatform } from './planner';
import type { RealVideoQualityGateV2 } from './real-video-quality-gate';
import type { ShortVideoPublishReadiness } from './publish-readiness';
import { hasPassedRealVideoQualityGateV2 } from './real-video-quality-gate';

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

export function publishShortVideoDistribution(request: ShortVideoPublishRequest): ShortVideoPublishResult {
  const adapter = ADAPTERS[request.platform];
  if (!adapter) {
    return buildResult(request, 'unsupported', 'blocked', ['แพลตฟอร์มนี้ยังไม่รองรับ']);
  }

  if (request.dry_run !== false) {
    return adapter.dryRun(request);
  }

  const manualProof = maybeRecordManualProof(request);
  if (manualProof) {
    return buildResult(request, adapter.name, 'proof_recorded', [], manualProof);
  }

  const blockedReasons = requirementBlockReasons(request);
  if (blockedReasons.length) {
    return buildResult(request, adapter.name, 'blocked', blockedReasons);
  }

  return buildResult(request, adapter.name, 'blocked', [
    'real publish adapter skeleton พร้อม gate แล้ว แต่ยังไม่เรียก platform API ใน validation/CLI; owner ต้องคลิกจาก UI หลังเปิด flags และต่อ provider จริง',
  ]);
}

export const SHORT_VIDEO_PLATFORM_ADAPTERS = ADAPTERS;
