import type { ShortVideoPlatform, ShortVideoPlatformVariant } from './planner';
import type { RealVideoQualityGateV2 } from './real-video-quality-gate';
import { hasPassedRealVideoQualityGateV2 } from './real-video-quality-gate';
import type { ShortVideoOwnerReviewDecisionState } from './owner-review-decisions';

export type ShortVideoPublishReadiness = {
  platform: ShortVideoPlatform;
  owner_approved: boolean;
  real_video_quality_gate_passed: boolean;
  provider_connected: boolean;
  target_selected: boolean;
  video_url_200: boolean;
  caption_present: boolean;
  publish_allowed: boolean;
  blocked_reasons: string[];
};

const providerFlagByPlatform: Record<ShortVideoPlatform, string> = {
  youtube_shorts: 'YOUTUBE_SHORTS_PUBLISH_ENABLED',
  facebook_reels: 'FACEBOOK_REELS_PUBLISH_ENABLED',
  instagram_reels: 'INSTAGRAM_REELS_PUBLISH_ENABLED',
  tiktok: 'TIKTOK_PUBLISH_ENABLED',
};

const thaiBlockedReason: Record<string, string> = {
  owner_approval_missing: 'ยังไม่ได้รับ owner approval สำหรับแพลตฟอร์มนี้',
  real_video_quality_gate_not_passed: 'Real Video Quality Gate v2 ยังไม่ผ่าน',
  provider_not_connected_or_disabled: 'ยังไม่ได้เชื่อมต่อ/เปิดใช้ provider ของแพลตฟอร์มนี้',
  target_not_selected: 'ยังไม่ได้เลือก target account/page/channel ปลายทาง',
  video_url_not_reachable: 'ตรวจ video URL แล้วยังไม่พร้อมใช้งาน (ต้องได้ 200 หรือเป็นไฟล์ public ที่มีอยู่)',
  caption_missing: 'ยังไม่มี caption สำหรับโพสต์',
};

function captionFromVariant(variant: ShortVideoPlatformVariant): string {
  const metadata = variant.metadata as Record<string, unknown>;
  return String(metadata.caption || metadata.description || metadata.title || '').trim();
}

function hasTargetSelected(variant: ShortVideoPlatformVariant): boolean {
  const metadata = variant.metadata as Record<string, unknown>;
  if (variant.platform === 'facebook_reels') return String(metadata.page_id || '').trim() !== '' && metadata.page_id !== 'FACEBOOK_PAGE_ID_PLACEHOLDER';
  if (variant.platform === 'youtube_shorts') return Boolean(metadata.privacy_status);
  if (variant.platform === 'instagram_reels') return true;
  if (variant.platform === 'tiktok') return metadata.publish_mode === 'manual_review';
  return false;
}

export function buildShortVideoPublishReadiness(
  variant: ShortVideoPlatformVariant,
  realVideoQualityGateV2: RealVideoQualityGateV2,
  ownerDecisionState?: ShortVideoOwnerReviewDecisionState | null,
): ShortVideoPublishReadiness {
  const ownerApproved = ownerDecisionState?.status === 'approved_for_manual_publish';
  const realGatePassed = hasPassedRealVideoQualityGateV2(realVideoQualityGateV2);
  const providerConnected = process.env.REAL_SOCIAL_PUBLISH_ENABLED === 'true'
    && process.env[providerFlagByPlatform[variant.platform]] === 'true';
  const targetSelected = hasTargetSelected(variant);
  const videoUrl200 = realVideoQualityGateV2.ffprobe_performed && realVideoQualityGateV2.video_stream;
  const captionPresent = captionFromVariant(variant).length > 0;

  const blockedCodes = [
    ownerApproved ? null : 'owner_approval_missing',
    realGatePassed ? null : 'real_video_quality_gate_not_passed',
    providerConnected ? null : 'provider_not_connected_or_disabled',
    targetSelected ? null : 'target_not_selected',
    videoUrl200 ? null : 'video_url_not_reachable',
    captionPresent ? null : 'caption_missing',
  ].filter((item): item is string => Boolean(item));

  return {
    platform: variant.platform,
    owner_approved: ownerApproved,
    real_video_quality_gate_passed: realGatePassed,
    provider_connected: providerConnected,
    target_selected: targetSelected,
    video_url_200: videoUrl200,
    caption_present: captionPresent,
    publish_allowed: blockedCodes.length === 0,
    blocked_reasons: blockedCodes.map((code) => thaiBlockedReason[code] || code),
  };
}
