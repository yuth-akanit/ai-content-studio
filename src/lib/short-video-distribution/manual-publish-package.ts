import {
  buildShortVideoPreviewQueue,
  type PlatformMetadata,
  type ShortVideoPlatform,
  type ShortVideoPlatformVariant,
} from '@/lib/short-video-distribution/planner';
import { sampleApprovedMasterVerticalVideo } from '@/lib/short-video-distribution/sample-fixture';
import { sampleMediaComposerMasterVideoRecord } from '@/lib/media-composer';
import type { ShortVideoOwnerReviewDecisionState } from '@/lib/short-video-distribution/owner-review-decisions';

export type ShortVideoPreviewSourceMetadata = {
  master_video_id: string;
  master_video_url: string;
  final_master_video_url: string;
  video_asset_id: string;
  raw_video_asset_id: string;
  voiceover_asset_id: string;
  final_master_video_asset_id: string;
  analyzed_video_asset_id: string;
  asset_role: string;
  generated_voiceover_used: boolean;
  voiceover_audio_used: boolean;
  audio_mix_mode: string;
  audio_expectation: 'required' | 'optional';
  source_type: string;
  source_badge: string;
  source_id: string;
  tts_script: string;
  fallback_used: boolean;
  source_label: 'real_media_composer_preview_metadata' | 'static_sample_fixture_fallback';
};

export type ManualPublishPackageSafetyFlags = {
  facebook_publish_enabled: false;
  instagram_publish_enabled: false;
  tiktok_publish_enabled: false;
  youtube_publish_enabled: false;
  line_broadcast_enabled: false;
  scheduler_enabled: false;
  production_actions_performed: false;
  external_api_calls_performed: false;
  mark_posted_performed: false;
};

export type ManualPublishPackage = {
  package_id: string;
  master_video_id: string;
  variant_id: string;
  platform: ShortVideoPlatform;
  platform_label: string;
  owner_decision: string;
  source_badge: string;
  source_id: string;
  source_type: string;
  master_video_url: string;
  caption: string;
  hashtags: string[];
  cta: string;
  suggested_manual_steps: string[];
  creative_score: number;
  readiness: 'approved_for_manual_export' | 'ready_for_owner_review_manual_export';
  generated_at: string;
  safety_flags: ManualPublishPackageSafetyFlags;
};

export const MANUAL_PUBLISH_PACKAGE_SAFETY_FLAGS: ManualPublishPackageSafetyFlags = Object.freeze({
  facebook_publish_enabled: false,
  instagram_publish_enabled: false,
  tiktok_publish_enabled: false,
  youtube_publish_enabled: false,
  line_broadcast_enabled: false,
  scheduler_enabled: false,
  production_actions_performed: false,
  external_api_calls_performed: false,
  mark_posted_performed: false,
});

function cleanText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function firstParam(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  const text = Array.isArray(value) ? value[0] : value;
  return cleanText(text);
}

function isHttpOrLocalVideoReference(value: string): boolean {
  return /^https?:\/\//.test(value) || value.startsWith('/');
}

function boolFromParam(value: string, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function hashtagsFromText(text: string): string[] {
  return [...new Set((text.match(/#[\p{L}\p{N}_-]+/gu) || []).map((tag) => tag.trim()).filter(Boolean))];
}

function metadataCaption(metadata: PlatformMetadata): string {
  const record = metadata as Record<string, unknown>;
  if (typeof record.caption === 'string') return record.caption;
  if (typeof record.description === 'string') return record.description;
  if (typeof record.title === 'string') return record.title;
  return JSON.stringify(metadata);
}

function metadataHashtags(metadata: PlatformMetadata): string[] {
  const record = metadata as Record<string, unknown>;
  if (Array.isArray(record.hashtags)) return record.hashtags.map((tag) => cleanText(tag)).filter(Boolean);
  if (Array.isArray(record.tags)) return record.tags.map((tag) => `#${cleanText(tag).replace(/^#/, '').replace(/\s+/g, '')}`).filter((tag) => tag !== '#');
  return hashtagsFromText(metadataCaption(metadata));
}

function metadataCta(metadata: PlatformMetadata): string {
  const record = metadata as Record<string, unknown>;
  if (typeof record.cta === 'string') return record.cta;
  const caption = metadataCaption(metadata);
  return caption.split('\n').map((line) => line.trim()).find((line) => /ทัก|จอง|ติดต่อ|book/i.test(line)) || 'ตรวจข้อความแล้วนำไปโพสต์เองแบบ manual เท่านั้น';
}

function manualStepsForPlatform(platformLabel: string): string[] {
  return [
    `ดาวน์โหลดหรือเปิด master video URL แล้วอัปโหลดเองใน ${platformLabel}`,
    'คัดลอก caption / hashtags / CTA จาก package นี้',
    'ตรวจ owner decision และ safety flags ว่ายังเป็น manual export only',
    'โพสต์ด้วยบัญชีแอดมินเองเท่านั้น ระบบนี้ไม่เรียก platform API',
  ];
}

export function buildShortVideoPreviewSourceMetadata(
  params: Record<string, string | string[] | undefined>,
): ShortVideoPreviewSourceMetadata {
  const requestedMasterVideoUrl = firstParam(params, 'master_video_url');
  const requestedFinalMasterVideoUrl = firstParam(params, 'final_master_video_url');
  const rawVideoAssetId = firstParam(params, 'raw_video_asset_id');
  const finalMasterVideoAssetId = firstParam(params, 'final_master_video_asset_id');
  const videoAssetId = firstParam(params, 'video_asset_id');
  const audioExpectation = firstParam(params, 'audio_expectation') === 'optional' ? 'optional' : 'required';
  const finalCompositionExpected = audioExpectation === 'required' && Boolean(rawVideoAssetId);
  const trustedFinalMasterUrl = isHttpOrLocalVideoReference(requestedFinalMasterVideoUrl) ? requestedFinalMasterVideoUrl : '';
  const trustedRequestedMasterUrl = isHttpOrLocalVideoReference(requestedMasterVideoUrl) ? requestedMasterVideoUrl : '';
  const analyzedVideoAssetId = finalMasterVideoAssetId || (finalCompositionExpected ? '' : videoAssetId);
  const masterVideoUrl = trustedFinalMasterUrl
    || (finalMasterVideoAssetId ? `https://studio.paaair.online/api/product-video/assets/${encodeURIComponent(finalMasterVideoAssetId)}` : '')
    || (finalCompositionExpected ? '' : trustedRequestedMasterUrl)
    || sampleApprovedMasterVerticalVideo.video_url;
  const sourceBadge = firstParam(params, 'source_badge') || sampleMediaComposerMasterVideoRecord.source_badge;
  const hasRealPreviewMetadata = Boolean(
    firstParam(params, 'master_video_id')
      || firstParam(params, 'source_id')
      || requestedMasterVideoUrl
      || requestedFinalMasterVideoUrl
      || finalMasterVideoAssetId
      || firstParam(params, 'tts_script'),
  ) && sourceBadge !== 'sample';
  const fallbackUsed = boolFromParam(firstParam(params, 'fallback_used'), !hasRealPreviewMetadata);

  return {
    master_video_id: firstParam(params, 'master_video_id') || sampleApprovedMasterVerticalVideo.id,
    master_video_url: masterVideoUrl,
    final_master_video_url: trustedFinalMasterUrl || (finalMasterVideoAssetId ? masterVideoUrl : ''),
    video_asset_id: videoAssetId || analyzedVideoAssetId,
    raw_video_asset_id: rawVideoAssetId,
    voiceover_asset_id: firstParam(params, 'voiceover_asset_id'),
    final_master_video_asset_id: finalMasterVideoAssetId,
    analyzed_video_asset_id: analyzedVideoAssetId,
    asset_role: firstParam(params, 'asset_role') || (finalMasterVideoAssetId ? 'final_master_video' : ''),
    generated_voiceover_used: boolFromParam(firstParam(params, 'generated_voiceover_used'), false),
    voiceover_audio_used: boolFromParam(firstParam(params, 'voiceover_audio_used'), false),
    audio_mix_mode: firstParam(params, 'audio_mix_mode') || 'voiceover_only',
    audio_expectation: audioExpectation,
    source_type: firstParam(params, 'source_type') || sampleMediaComposerMasterVideoRecord.source_type,
    source_badge: sourceBadge,
    source_id: firstParam(params, 'source_id') || 'sample-image-pair',
    tts_script: firstParam(params, 'tts_script') || sampleMediaComposerMasterVideoRecord.tts_script,
    fallback_used: fallbackUsed,
    source_label: fallbackUsed ? 'static_sample_fixture_fallback' : 'real_media_composer_preview_metadata',
  };
}

export function buildManualPublishPackage(
  variant: ShortVideoPlatformVariant,
  source: ShortVideoPreviewSourceMetadata,
  ownerDecisionState?: ShortVideoOwnerReviewDecisionState | null,
): ManualPublishPackage | null {
  const isOwnerApproved = ownerDecisionState?.status === 'approved_for_manual_publish';
  const isReadyForReview = variant.creative_quality_gate.decision === 'ready_for_owner_review';
  if (!isOwnerApproved && !isReadyForReview) return null;

  const ownerDecision = ownerDecisionState?.status || 'ready_for_owner_review';
  const readiness = isOwnerApproved ? 'approved_for_manual_export' : 'ready_for_owner_review_manual_export';

  return {
    package_id: `${variant.variant_id}-manual-publish-package-v1`,
    master_video_id: variant.master_video_id,
    variant_id: variant.variant_id,
    platform: variant.platform,
    platform_label: variant.platform_label,
    owner_decision: ownerDecision,
    source_badge: source.source_badge,
    source_id: source.source_id,
    source_type: source.source_type,
    master_video_url: variant.video_url || source.master_video_url,
    caption: metadataCaption(variant.metadata),
    hashtags: metadataHashtags(variant.metadata),
    cta: metadataCta(variant.metadata),
    suggested_manual_steps: manualStepsForPlatform(variant.platform_label),
    creative_score: variant.creative_quality_gate.creative_score,
    readiness,
    generated_at: '2026-06-07T00:00:00.000Z',
    safety_flags: { ...MANUAL_PUBLISH_PACKAGE_SAFETY_FLAGS },
  };
}

export function buildManualPublishPackages(
  source: ShortVideoPreviewSourceMetadata,
  ownerDecisionStateByVariant: Record<string, ShortVideoOwnerReviewDecisionState> = {},
): ManualPublishPackage[] {
  const masterVideoForPreview = {
    ...sampleApprovedMasterVerticalVideo,
    id: source.master_video_id,
    video_url: source.master_video_url,
    visual_notes: `${sampleApprovedMasterVerticalVideo.visual_notes || ''} Media Composer source_badge=${source.source_badge}; source_id=${source.source_id}; source_type=${source.source_type}.`,
    creative_angle: source.fallback_used
      ? sampleApprovedMasterVerticalVideo.creative_angle
      : `ใช้ metadata จริงจาก Media Composer render: ${source.source_badge} / ${source.source_id}`,
  };
  const preview = buildShortVideoPreviewQueue(masterVideoForPreview);
  return preview.preview_queue
    .map((variant) => buildManualPublishPackage(variant, source, ownerDecisionStateByVariant[variant.variant_id] || null))
    .filter((item): item is ManualPublishPackage => Boolean(item));
}

export function allManualPublishPackageSafetyFlagsFalse(flags: ManualPublishPackageSafetyFlags): boolean {
  return Object.values(flags).every((value) => value === false);
}
