import { rewriteInternalCaptionWording } from '@/lib/caption-safety';
export type ShortVideoPlatform = 'youtube_shorts' | 'facebook_reels' | 'instagram_reels' | 'tiktok';

export type MasterVerticalVideo = {
  id: string;
  approval_status: 'approved';
  asset_type: 'vertical_mp4';
  video_url: string;
  duration_seconds: number;
  aspect_ratio: '9:16' | '0.5625';
  brand: string;
  title: string;
  service: string;
  service_area: string;
  value_prop?: string;
  cta: string;
  language?: string;
  tags: string[];
  hook?: string;
  visual_notes?: string;
  creative_angle?: string;
  youtube_privacy_status?: 'private' | 'unlisted' | 'public';
};

type YouTubeShortsMetadata = {
  title: string;
  description: string;
  tags: string[];
  privacy_status: 'private' | 'unlisted' | 'public';
};

type FacebookReelsMetadata = {
  caption: string;
  cta: string;
  page_id: 'FACEBOOK_PAGE_ID_PLACEHOLDER';
};

type InstagramReelsMetadata = {
  caption: string;
  hashtags: string[];
};

type TikTokMetadata = {
  caption: string;
  publish_mode: 'manual_review';
};

export type PlatformMetadata = YouTubeShortsMetadata | FacebookReelsMetadata | InstagramReelsMetadata | TikTokMetadata;

export const SHORT_VIDEO_PLATFORMS: Record<ShortVideoPlatform, { label: string; requiredFields: string[]; maxCaptionLength: number }> = {
  youtube_shorts: {
    label: 'YouTube Shorts',
    requiredFields: ['title', 'description', 'tags', 'privacy_status'],
    maxCaptionLength: 5000,
  },
  facebook_reels: {
    label: 'Facebook Reels',
    requiredFields: ['caption', 'cta', 'page_id'],
    maxCaptionLength: 2200,
  },
  instagram_reels: {
    label: 'Instagram Reels',
    requiredFields: ['caption', 'hashtags'],
    maxCaptionLength: 2200,
  },
  tiktok: {
    label: 'TikTok',
    requiredFields: ['caption', 'publish_mode'],
    maxCaptionLength: 2200,
  },
};

export const SHORT_VIDEO_PREVIEW_ONLY_FLAGS = Object.freeze({
  publish_requested: false,
  publish_enabled: false,
  publish_attempted: false,
  scheduler_enabled: false,
  line_broadcast_enabled: false,
  production_actions_performed: false,
});

export type ShortVideoPublishFlags = typeof SHORT_VIDEO_PREVIEW_ONLY_FLAGS;

export type QualityGateCheck = {
  name: string;
  pass: boolean;
  weight: number;
};

export type QualityGate = {
  score: number;
  passed: boolean;
  threshold: 80;
  checks: QualityGateCheck[];
};

export type CreativeQualityDecision = 'ready_for_owner_review' | 'needs_improvement' | 'blocked_from_publish';

export type CreativeQualityGate = {
  creative_score: number;
  hook_score: number;
  visual_clarity_score: number;
  platform_fit_score: number;
  caption_strength_score: number;
  cta_score: number;
  decision: CreativeQualityDecision;
  recommendations: string[];
};

export type PublishReadinessReport = {
  platform: ShortVideoPlatform;
  platform_label: string;
  ready_for_manual_review: boolean;
  ready_for_api_publish_phase: false;
  publish_blocked_reason: string;
  missing_fields: string[];
  quality_score: number;
  quality_threshold: 80;
  publish_flags: ShortVideoPublishFlags;
};

export type ShortVideoPlatformVariant = {
  variant_id: string;
  master_video_id: string;
  platform: ShortVideoPlatform;
  platform_label: string;
  video_url: string;
  metadata: PlatformMetadata;
  quality_gate: QualityGate;
  creative_quality_gate: CreativeQualityGate;
  publish_readiness_report: PublishReadinessReport;
  publish_flags: ShortVideoPublishFlags;
  created_at: string;
};

export type ShortVideoPreviewQueue = {
  module: 'paa_short_video_distribution_planner';
  mode: 'preview_only';
  production_actions_performed: false;
  master_video_id: string;
  generated_at: string;
  quality_gate_threshold: 80;
  preview_queue: ShortVideoPlatformVariant[];
  summary: {
    variant_count: number;
    platforms: ShortVideoPlatform[];
    all_publish_flags_false: boolean;
    all_quality_gates_passed: boolean;
    average_creative_score: number;
    ready_count: number;
    needs_improvement_count: number;
    blocked_count: number;
    production_actions_performed: false;
  };
};

function cleanText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).replace(/\s+/g, ' ').trim();
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((tag) => cleanText(tag).replace(/^#/, '')).filter(Boolean))];
}

function hashtags(tags: string[]): string[] {
  return uniqueTags(tags).map((tag) => `#${tag.replace(/\s+/g, '')}`);
}

function truncate(text: string, max: number): string {
  const value = cleanText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function hasField(metadata: PlatformMetadata, field: string): boolean {
  const value = (metadata as Record<string, unknown>)[field];
  return value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length > 0);
}

function isHttpOrLocalVideoUrl(value: string): boolean {
  return /^https?:\/\//.test(value || '') || /^\//.test(value || '');
}

function assertApprovedMasterVideo(masterVideo: MasterVerticalVideo): void {
  const errors: string[] = [];
  if (masterVideo.approval_status !== 'approved') errors.push('approval_status must be approved');
  if (masterVideo.asset_type !== 'vertical_mp4') errors.push('asset_type must be vertical_mp4');
  if (!isHttpOrLocalVideoUrl(masterVideo.video_url || '')) errors.push('video_url must be an http(s) URL or local public path');
  if (Number(masterVideo.duration_seconds || 0) <= 0) errors.push('duration_seconds must be greater than zero');
  if (!/^(9:16|0\.5625)$/.test(masterVideo.aspect_ratio || '')) errors.push('aspect_ratio must be 9:16');
  if (errors.length) {
    throw new Error(`Master video is not eligible for preview planning: ${errors.join('; ')}`);
  }
}

function generatePlatformMetadata(masterVideo: MasterVerticalVideo): Record<ShortVideoPlatform, PlatformMetadata> {
  const brand = cleanText(masterVideo.brand, 'PA Air Service');
  const service = cleanText(masterVideo.service, 'ล้างแอร์บ้าน');
  const area = cleanText(masterVideo.service_area, 'สมุทรปราการ');
  const title = rewriteInternalCaptionWording(cleanText(masterVideo.title, `${brand} ${service}`));
  const valueProp = rewriteInternalCaptionWording(cleanText(masterVideo.value_prop, 'ทีมช่างท้องถิ่น นัดหมายง่าย ดูแลแอร์ให้เย็นไวและสะอาดขึ้น'));
  const cta = rewriteInternalCaptionWording(cleanText(masterVideo.cta, 'ทักเพื่อจองคิวล้างแอร์กับ PA Air Service'));
  const tags = uniqueTags([
    ...masterVideo.tags,
    'PAAirService',
    'AirService',
    'ล้างแอร์',
    'ซ่อมแอร์',
    'สมุทรปราการ',
  ]);
  const hash = hashtags(tags).slice(0, 12);
  const opener = `${brand}: ${service} ใน${area}`;
  const benefit = valueProp || 'แอร์เย็นขึ้น อากาศสะอาดขึ้น พร้อมทีมช่างที่นัดหมายง่าย';
  const hook = cleanText(masterVideo.hook, 'แอร์ไม่เย็น?');

  return {
    youtube_shorts: {
      title: truncate(`${title} | #Shorts`, 100),
      description: rewriteInternalCaptionWording(truncate(`${opener}\n${benefit}\n\n${cta}\n\n${hash.slice(0, 6).join(' ')}`, 5000)),
      tags: tags.slice(0, 15),
      privacy_status: masterVideo.youtube_privacy_status || 'unlisted',
    },
    facebook_reels: {
      caption: rewriteInternalCaptionWording(truncate(`${opener}\n\n${benefit}\n\n${cta}`, 2200)),
      cta,
      page_id: 'FACEBOOK_PAGE_ID_PLACEHOLDER',
    },
    instagram_reels: {
      caption: rewriteInternalCaptionWording(truncate(`${opener}\n\n${benefit}\n\n${hash.slice(0, 10).join(' ')}`, 2200)),
      hashtags: hash.slice(0, 10),
    },
    tiktok: {
      caption: rewriteInternalCaptionWording(truncate(`${hook} เริ่มจากคลิปนี้ 👇 ${brand} ช่วยดูแล${service}ใน${area} | ${cta} ${hash.slice(0, 5).join(' ')}`, 2200)),
      publish_mode: 'manual_review',
    },
  };
}

function scoreQuality(masterVideo: MasterVerticalVideo, platform: ShortVideoPlatform, metadata: PlatformMetadata): QualityGate {
  const rules = SHORT_VIDEO_PLATFORMS[platform];
  const checks: QualityGateCheck[] = [
    { name: 'approved_vertical_mp4', pass: masterVideo.approval_status === 'approved' && masterVideo.asset_type === 'vertical_mp4', weight: 20 },
    { name: 'has_video_url', pass: isHttpOrLocalVideoUrl(masterVideo.video_url || ''), weight: 10 },
    { name: 'duration_short_video_ready', pass: masterVideo.duration_seconds > 0 && masterVideo.duration_seconds <= 90, weight: 10 },
    { name: 'safe_preview_only_flags', pass: Object.values(SHORT_VIDEO_PREVIEW_ONLY_FLAGS).every((value) => value === false), weight: 20 },
    { name: 'required_platform_fields', pass: rules.requiredFields.every((field) => hasField(metadata, field)), weight: 20 },
    { name: 'caption_length_ok', pass: !('caption' in metadata) || metadata.caption.length <= rules.maxCaptionLength, weight: 10 },
    { name: 'brand_or_service_present', pass: JSON.stringify(metadata).toLowerCase().includes(masterVideo.brand.toLowerCase().split(' ')[0]) || JSON.stringify(metadata).toLowerCase().includes(masterVideo.service.toLowerCase()), weight: 10 },
  ];
  const score = checks.reduce((total, check) => total + (check.pass ? check.weight : 0), 0);
  return { score, passed: score >= 80, threshold: 80, checks };
}

function getCaptionText(metadata: PlatformMetadata): string {
  if ('caption' in metadata) return metadata.caption;
  if ('description' in metadata) return metadata.description;
  return JSON.stringify(metadata);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function creativeDecision(creativeScore: number): CreativeQualityDecision {
  if (creativeScore >= 80) return 'ready_for_owner_review';
  if (creativeScore >= 60) return 'needs_improvement';
  return 'blocked_from_publish';
}

function scoreCreativeQuality(masterVideo: MasterVerticalVideo, platform: ShortVideoPlatform, metadata: PlatformMetadata): CreativeQualityGate {
  const caption = getCaptionText(metadata);
  const lowerCaption = caption.toLowerCase();
  const hookText = cleanText(masterVideo.hook, 'แอร์ไม่เย็น?');
  const hasQuestionOrEmoji = /[?？!！👇✨]/.test(caption);
  const hasBenefit = lowerCaption.includes('เย็น') || lowerCaption.includes('สะอาด') || lowerCaption.includes('นัด') || lowerCaption.includes('clean');
  const hasCta = lowerCaption.includes('ทัก') || lowerCaption.includes('จอง') || lowerCaption.includes('book') || lowerCaption.includes('ติดต่อ');
  const hasBrand = lowerCaption.includes(masterVideo.brand.toLowerCase().split(' ')[0]);
  const hasService = lowerCaption.includes(masterVideo.service.toLowerCase());
  const hasVisualNotes = cleanText(masterVideo.visual_notes).length >= 20;
  const hasCreativeAngle = cleanText(masterVideo.creative_angle).length >= 10;
  const hasHashtags = 'hashtags' in metadata ? metadata.hashtags.length >= 4 : lowerCaption.includes('#');

  const hook_score = clampScore(55 + (caption.startsWith(hookText) ? 20 : 0) + (hasQuestionOrEmoji ? 15 : 0) + (platform === 'tiktok' ? 10 : 5));
  const visual_clarity_score = clampScore(60 + (hasVisualNotes ? 25 : 0) + (masterVideo.aspect_ratio === '9:16' ? 10 : 0) + (masterVideo.duration_seconds <= 60 ? 5 : 0));
  const platform_fit_score = clampScore(60 + (hasHashtags ? 10 : 0) + (platform === 'youtube_shorts' && 'title' in metadata && metadata.title.includes('#Shorts') ? 15 : 0) + (platform === 'tiktok' && 'publish_mode' in metadata && metadata.publish_mode === 'manual_review' ? 15 : 0) + (platform === 'facebook_reels' && 'page_id' in metadata ? 10 : 0) + (platform === 'instagram_reels' && 'hashtags' in metadata ? 15 : 0));
  const caption_strength_score = clampScore(55 + (hasBrand ? 10 : 0) + (hasService ? 10 : 0) + (hasBenefit ? 15 : 0) + (hasCreativeAngle ? 10 : 0));
  const cta_score = clampScore(50 + (hasCta ? 35 : 0) + (metadata && 'cta' in metadata ? 15 : 0));
  const creative_score = clampScore((hook_score + visual_clarity_score + platform_fit_score + caption_strength_score + cta_score) / 5);
  const decision = creativeDecision(creative_score);
  const recommendations = [
    hook_score < 80 ? 'เพิ่ม hook 1-2 วินาทีแรกให้ชัดขึ้น เช่น ปัญหาแอร์ไม่เย็น/ค่าไฟสูง' : null,
    visual_clarity_score < 80 ? 'ระบุภาพหลักหรือ before/after ให้ชัดเพื่อช่วยทีมตรวจวิดีโอ' : null,
    platform_fit_score < 80 ? 'ปรับ metadata ให้ตรงธรรมชาติของแพลตฟอร์ม เช่น Shorts tag, hashtags, หรือ manual review marker' : null,
    caption_strength_score < 80 ? 'เพิ่ม benefit ที่ลูกค้าเข้าใจทันที เช่น เย็นไว สะอาดขึ้น นัดง่าย' : null,
    cta_score < 80 ? 'เพิ่ม CTA ให้ชัด เช่น ทักเพื่อจองคิวหรือขอราคา' : null,
  ].filter((item): item is string => Boolean(item));

  return {
    creative_score,
    hook_score,
    visual_clarity_score,
    platform_fit_score,
    caption_strength_score,
    cta_score,
    decision,
    recommendations: recommendations.length ? recommendations : ['พร้อมให้เจ้าของตรวจทานแบบ preview-only ก่อนนำไปโพสต์เอง'],
  };
}

function readinessReport(platform: ShortVideoPlatform, metadata: PlatformMetadata, qualityGate: QualityGate): PublishReadinessReport {
  const rules = SHORT_VIDEO_PLATFORMS[platform];
  return {
    platform,
    platform_label: rules.label,
    ready_for_manual_review: qualityGate.passed,
    ready_for_api_publish_phase: false,
    publish_blocked_reason: 'Preview-only module: API publishing is disabled until a separately approved future phase.',
    missing_fields: rules.requiredFields.filter((field) => !hasField(metadata, field)),
    quality_score: qualityGate.score,
    quality_threshold: 80,
    publish_flags: { ...SHORT_VIDEO_PREVIEW_ONLY_FLAGS },
  };
}

export function buildShortVideoPreviewQueue(masterVideo: MasterVerticalVideo): ShortVideoPreviewQueue {
  assertApprovedMasterVideo(masterVideo);
  const generatedAt = '2026-06-07T00:00:00.000Z';
  const platformMetadata = generatePlatformMetadata(masterVideo);
  const preview_queue = (Object.keys(SHORT_VIDEO_PLATFORMS) as ShortVideoPlatform[]).map((platform) => {
    const metadata = platformMetadata[platform];
    const quality_gate = scoreQuality(masterVideo, platform, metadata);
    const creative_quality_gate = scoreCreativeQuality(masterVideo, platform, metadata);
    return {
      variant_id: `${masterVideo.id}-${platform}`,
      master_video_id: masterVideo.id,
      platform,
      platform_label: SHORT_VIDEO_PLATFORMS[platform].label,
      video_url: masterVideo.video_url,
      metadata,
      quality_gate,
      creative_quality_gate,
      publish_readiness_report: readinessReport(platform, metadata, quality_gate),
      publish_flags: { ...SHORT_VIDEO_PREVIEW_ONLY_FLAGS },
      created_at: generatedAt,
    };
  });
  const creativeScores = preview_queue.map((variant) => variant.creative_quality_gate.creative_score);
  const averageCreativeScore = clampScore(creativeScores.reduce((total, score) => total + score, 0) / Math.max(creativeScores.length, 1));

  return {
    module: 'paa_short_video_distribution_planner',
    mode: 'preview_only',
    production_actions_performed: false,
    master_video_id: masterVideo.id,
    generated_at: generatedAt,
    quality_gate_threshold: 80,
    preview_queue,
    summary: {
      variant_count: preview_queue.length,
      platforms: preview_queue.map((variant) => variant.platform),
      all_publish_flags_false: preview_queue.every((variant) => Object.values(variant.publish_flags).every((value) => value === false)),
      all_quality_gates_passed: preview_queue.every((variant) => variant.quality_gate.passed),
      average_creative_score: averageCreativeScore,
      ready_count: preview_queue.filter((variant) => variant.creative_quality_gate.decision === 'ready_for_owner_review').length,
      needs_improvement_count: preview_queue.filter((variant) => variant.creative_quality_gate.decision === 'needs_improvement').length,
      blocked_count: preview_queue.filter((variant) => variant.creative_quality_gate.decision === 'blocked_from_publish').length,
      production_actions_performed: false,
    },
  };
}
