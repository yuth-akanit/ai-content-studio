export type ProductVideoQualityDecision =
  | 'ready_for_owner_review'
  | 'needs_improvement'
  | 'blocked_low_quality';

export interface ProductVideoQualityScore {
  content_id: string;
  quality_score: number;
  hook_score: number;
  visual_clarity_score: number;
  before_after_score: number;
  caption_score: number;
  cta_score: number;
  decision: ProductVideoQualityDecision;
}

export const PRODUCT_VIDEO_RENDER_QUALITY_BLOCK_REASON = 'Quality score is too low for render.';
export const PRODUCT_VIDEO_PUBLISH_QUALITY_BLOCK_REASON = 'Quality score is too low for publish.';
export const PRODUCT_VIDEO_QUALITY_MISSING_RENDER_REASON = 'Quality score is missing for render.';
export const PRODUCT_VIDEO_QUALITY_MISSING_PUBLISH_REASON = 'Quality score is missing for publish.';
export const PRODUCT_VIDEO_QUALITY_DECISION_BLOCK_REASON = 'Quality decision is not ready_for_owner_review.';

const MAX_SUB_SCORE = 20;
const READY_THRESHOLD = 80;
const IMPROVEMENT_THRESHOLD = 60;
const RENDER_THRESHOLD = 70;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function clampSubScore(value: unknown): number {
  const numeric = typeof value === 'number'
    ? value
    : typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : 0;
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(MAX_SUB_SCORE, Math.round(numeric)));
}

function hasAny(value: string, terms: string[]): boolean {
  const lower = value.toLowerCase();
  return terms.some((term) => lower.includes(term.toLowerCase()));
}

function countPresent(values: string[]): number {
  return values.filter((value) => value.length > 0).length;
}

export function computeQualityDecision(qualityScore: number): ProductVideoQualityDecision {
  if (qualityScore >= READY_THRESHOLD) return 'ready_for_owner_review';
  if (qualityScore >= IMPROVEMENT_THRESHOLD) return 'needs_improvement';
  return 'blocked_low_quality';
}

export function normalizeQualityScore(input: Partial<ProductVideoQualityScore> & { preview_id?: unknown; content_id?: unknown }): ProductVideoQualityScore | null {
  const subScoreKeys = [
    'hook_score',
    'visual_clarity_score',
    'before_after_score',
    'caption_score',
    'cta_score',
  ] as const;
  const hasAnyScore = subScoreKeys.some((key) => input[key] !== undefined && input[key] !== null);
  if (!hasAnyScore) return null;

  const hookScore = clampSubScore(input.hook_score);
  const visualClarityScore = clampSubScore(input.visual_clarity_score);
  const beforeAfterScore = clampSubScore(input.before_after_score);
  const captionScore = clampSubScore(input.caption_score);
  const ctaScore = clampSubScore(input.cta_score);
  const computedQualityScore = hookScore + visualClarityScore + beforeAfterScore + captionScore + ctaScore;

  return {
    content_id: cleanText(input.content_id) || cleanText(input.preview_id),
    quality_score: computedQualityScore,
    hook_score: hookScore,
    visual_clarity_score: visualClarityScore,
    before_after_score: beforeAfterScore,
    caption_score: captionScore,
    cta_score: ctaScore,
    decision: computeQualityDecision(computedQualityScore),
  };
}

export function evaluateProductVideoQualityScore(input: Record<string, unknown>): ProductVideoQualityScore {
  const contentId = cleanText(input.preview_id) || cleanText(input.content_id) || cleanText(input.asset_id) || 'product-video-preview';
  const hook = cleanText(input.hook);
  const title = cleanText(input.video_title);
  const sceneScript = cleanText(input.scene_script);
  const overlays = cleanText(input.overlay_texts);
  const voiceover = cleanText(input.voiceover_full);
  const caption = cleanText(input.marketing_caption) || cleanText(input.caption) || cleanText(input.publish_caption);
  const hashtags = cleanText(input.hashtags);
  const brief = cleanText(input.brief);
  const publicImageUrl = cleanText(input.public_image_url);
  const imageUrls = Array.isArray(input.image_urls) ? input.image_urls.map(cleanText).filter(Boolean) : [];
  const combined = [hook, title, sceneScript, overlays, voiceover, caption, hashtags, brief].join(' ');

  let hookScore = 8;
  if (hook.length >= 8) hookScore += 6;
  if (hasAny(hook || voiceover || caption, ['ปัญหา', 'เจ็บ', 'เสีย', 'ไม่ทัน', 'พลาด', 'ก่อน', 'ลูกค้า', 'งาน'])) hookScore += 4;
  if ((hook || title).length >= 20 && (hook || title).length <= 140) hookScore += 2;

  let visualClarityScore = 6;
  if (publicImageUrl) visualClarityScore += 4;
  if (imageUrls.length > 0) visualClarityScore += 3;
  if (sceneScript.length >= 40) visualClarityScore += 4;
  if (overlays.length >= 8) visualClarityScore += 3;

  let beforeAfterScore = 6;
  if (hasAny(combined, ['ก่อน', 'หลัง', 'before', 'after'])) beforeAfterScore += 7;
  if (hasAny(combined, ['ผลลัพธ์', 'เปลี่ยน', 'ดีขึ้น', 'ลด', 'เพิ่ม', 'แก้', 'เห็นภาพ'])) beforeAfterScore += 5;
  if (countPresent([sceneScript, overlays, brief]) >= 2) beforeAfterScore += 2;

  let captionScore = 5;
  if (caption.length >= 80) captionScore += 5;
  if (caption.length <= 1200) captionScore += 2;
  if (hashtags || caption.includes('#')) captionScore += 3;
  if (hasAny(caption, ['LINE', 'โทร', 'Phone', 'Website', 'http', 'สนใจ', 'ทัก'])) captionScore += 5;

  let ctaScore = 3;
  if (hasAny(caption, ['สนใจ', 'ทัก', 'จอง', 'ดูตัวอย่าง', 'ติดต่อ', 'โทร', 'LINE', 'Inbox'])) ctaScore += 8;
  if (hasAny(caption, ['http', 'lin.ee', 'เบอร์', 'Phone', 'โทร'])) ctaScore += 5;
  if (hasAny(combined, ['วันนี้', 'ตอนนี้', 'ฟรี', 'ทดลอง', 'นัดหมาย'])) ctaScore += 4;

  return normalizeQualityScore({
    content_id: contentId,
    hook_score: hookScore,
    visual_clarity_score: visualClarityScore,
    before_after_score: beforeAfterScore,
    caption_score: captionScore,
    cta_score: ctaScore,
  }) as ProductVideoQualityScore;
}

export function isRenderQualityAllowed(score: ProductVideoQualityScore | null | undefined): { allowed: boolean; reason: string | null } {
  if (!score) return { allowed: false, reason: PRODUCT_VIDEO_QUALITY_MISSING_RENDER_REASON };
  if (score.quality_score < RENDER_THRESHOLD) return { allowed: false, reason: PRODUCT_VIDEO_RENDER_QUALITY_BLOCK_REASON };
  return { allowed: true, reason: null };
}

export function isPublishQualityAllowed(score: ProductVideoQualityScore | null | undefined): { allowed: boolean; reason: string | null } {
  if (!score) return { allowed: false, reason: PRODUCT_VIDEO_QUALITY_MISSING_PUBLISH_REASON };
  if (score.quality_score < READY_THRESHOLD) return { allowed: false, reason: PRODUCT_VIDEO_PUBLISH_QUALITY_BLOCK_REASON };
  if (score.decision !== 'ready_for_owner_review') return { allowed: false, reason: PRODUCT_VIDEO_QUALITY_DECISION_BLOCK_REASON };
  return { allowed: true, reason: null };
}
