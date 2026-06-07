import {
  listProductVideoPreviewLogs,
  type ProductVideoPreviewLogRecord,
} from '@/lib/product-video-preview-log';
import {
  sampleMediaComposerImagePairInput,
  sampleMediaComposerRawVideoInput,
  type MediaComposerInput,
  type MediaComposerSourceType,
} from '@/lib/media-composer';

export type MediaComposerSourceBadge =
  | 'sample'
  | 'product_video_preview_log'
  | 'uploaded_asset'
  | 'minio_safe_url';

export type MediaComposerSourceOption = {
  id: string;
  label: string;
  source_type: MediaComposerSourceType;
  source_badge: MediaComposerSourceBadge;
  is_fallback_sample: boolean;
  preview_log_id?: string;
  created_at?: string;
  status?: string;
  media_status?: string;
  source_url_summary: string;
  input: MediaComposerInput;
};

const DEFAULT_CTA = 'ทัก PA Air Service เพื่อจองคิวล้างแอร์';
const DEFAULT_TTS_SCRIPT = sampleMediaComposerImagePairInput.tts_script;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function isSafeLocalMediaPath(value: string): boolean {
  return value.startsWith('/samples/') || value.startsWith('/api/product-video/assets/');
}

function isSafeStudioAssetUrl(url: URL): boolean {
  return url.hostname === 'studio.paaair.online' && url.pathname.startsWith('/api/product-video/assets/');
}

function isSafeAdminMediaUrl(url: URL): boolean {
  return url.hostname === 'admin.paaair.online' && url.pathname.startsWith('/media/');
}

export function isMediaComposerSafeMediaUrl(value: string): boolean {
  const text = cleanText(value);
  if (!text) return false;
  if (isSafeLocalMediaPath(text)) return true;
  try {
    const url = new URL(text);
    return (url.protocol === 'https:' || url.protocol === 'http:')
      && (isSafeStudioAssetUrl(url) || isSafeAdminMediaUrl(url));
  } catch {
    return false;
  }
}

function isVideoUrl(value: string): boolean {
  const text = cleanText(value).toLowerCase();
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/.test(text) || text.includes('/media/');
}

function summarizeUrl(value: string): string {
  const text = cleanText(value);
  if (!text) return '';
  if (text.startsWith('/')) return text;
  try {
    const url = new URL(text);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return text.slice(0, 80);
  }
}

function sourceBadgeForUrl(url: string, fallback: MediaComposerSourceBadge): MediaComposerSourceBadge {
  const text = cleanText(url);
  if (text.startsWith('/api/product-video/assets/') || text.includes('/api/product-video/assets/')) return 'uploaded_asset';
  if (text.includes('admin.paaair.online/media/')) return 'minio_safe_url';
  return fallback;
}

function isApprovedPreviewLog(record: ProductVideoPreviewLogRecord): boolean {
  return record.preview_only === true
    && record.real_posting_enabled === false
    && record.line_broadcast_enabled === false
    && record.schedule_enabled === false
    && record.publish_allowed === false
    && record.facebook_post_performed === false
    && record.line_broadcast_performed === false
    && record.status === 'approved_for_future_publish';
}

function makeTitle(record: ProductVideoPreviewLogRecord, fallback: string): string {
  return cleanText(record.video_title)
    || cleanText(record.hook)
    || cleanText(record.brief)
    || cleanText(record.caption).slice(0, 80)
    || fallback;
}

function baseText(record: ProductVideoPreviewLogRecord): { tts_script: string; cta_banner: string } {
  return {
    tts_script: cleanText(record.tts_script) || cleanText(record.voiceover_full) || DEFAULT_TTS_SCRIPT,
    cta_banner: cleanText(record.preview_note) || DEFAULT_CTA,
  };
}

function imagePairOption(record: ProductVideoPreviewLogRecord): MediaComposerSourceOption | null {
  const urls = uniqueStrings(record.image_urls || []).filter(isMediaComposerSafeMediaUrl);
  if (urls.length < 2) return null;
  const text = baseText(record);
  const input: MediaComposerInput = {
    source_type: 'image_pair',
    before_image_url: urls[0],
    after_image_url: urls[1],
    tts_script: text.tts_script,
    cta_banner: text.cta_banner,
    brand: 'PA Air Service',
    source_id: `preview-log-${record.preview_id}-image-pair`,
    source_badge: 'product_video_preview_log',
  };
  return {
    id: input.source_id || `preview-log-${record.preview_id}-image-pair`,
    label: `Image Pair · ${makeTitle(record, record.preview_id)}`,
    source_type: 'image_pair',
    source_badge: 'product_video_preview_log',
    is_fallback_sample: false,
    preview_log_id: record.preview_id,
    created_at: record.created_at,
    status: record.status,
    media_status: record.media_status,
    source_url_summary: `${summarizeUrl(urls[0])} → ${summarizeUrl(urls[1])}`,
    input,
  };
}

function rawVideoOption(record: ProductVideoPreviewLogRecord): MediaComposerSourceOption | null {
  const rawUrl = cleanText(record.public_media_url) || cleanText((record as unknown as Record<string, unknown>).video_url);
  if (!rawUrl || !isMediaComposerSafeMediaUrl(rawUrl) || !isVideoUrl(rawUrl)) return null;
  const text = baseText(record);
  const badge = sourceBadgeForUrl(rawUrl, 'product_video_preview_log');
  const input: MediaComposerInput = {
    source_type: 'raw_video',
    raw_video_url: rawUrl,
    tts_script: text.tts_script,
    cta_banner: text.cta_banner,
    brand: 'PA Air Service',
    source_id: `preview-log-${record.preview_id}-raw-video`,
    source_badge: badge,
  };
  return {
    id: input.source_id || `preview-log-${record.preview_id}-raw-video`,
    label: `Raw Video · ${makeTitle(record, record.preview_id)}`,
    source_type: 'raw_video',
    source_badge: badge,
    is_fallback_sample: false,
    preview_log_id: record.preview_id,
    created_at: record.created_at,
    status: record.status,
    media_status: record.media_status,
    source_url_summary: summarizeUrl(rawUrl),
    input,
  };
}

export function buildSampleMediaComposerSourceOptions(): MediaComposerSourceOption[] {
  return [
    {
      id: 'sample-image-pair',
      label: 'Sample · Image Pair before/after',
      source_type: 'image_pair',
      source_badge: 'sample',
      is_fallback_sample: true,
      source_url_summary: `${sampleMediaComposerImagePairInput.before_image_url} → ${sampleMediaComposerImagePairInput.after_image_url}`,
      input: {
        ...sampleMediaComposerImagePairInput,
        source_id: 'sample-image-pair',
        source_badge: 'sample',
      },
    },
    {
      id: 'sample-raw-video',
      label: 'Sample · Raw Video placeholder',
      source_type: 'raw_video',
      source_badge: 'sample',
      is_fallback_sample: true,
      source_url_summary: sampleMediaComposerRawVideoInput.raw_video_url,
      input: {
        ...sampleMediaComposerRawVideoInput,
        source_id: 'sample-raw-video',
        source_badge: 'sample',
      },
    },
  ];
}

export async function listReadOnlyMediaComposerSourceOptions(): Promise<{
  options: MediaComposerSourceOption[];
  fallback_used: boolean;
  source_counts: Record<MediaComposerSourceBadge, number>;
  production_actions_performed: false;
}> {
  const logs = await listProductVideoPreviewLogs();
  const realOptions = logs
    .filter(isApprovedPreviewLog)
    .flatMap((record) => [imagePairOption(record), rawVideoOption(record)])
    .filter((option): option is MediaComposerSourceOption => Boolean(option));
  const fallbackOptions = buildSampleMediaComposerSourceOptions();
  const options = realOptions.length ? [...realOptions, ...fallbackOptions] : fallbackOptions;
  const source_counts = options.reduce<Record<MediaComposerSourceBadge, number>>((counts, option) => {
    counts[option.source_badge] = (counts[option.source_badge] || 0) + 1;
    return counts;
  }, { sample: 0, product_video_preview_log: 0, uploaded_asset: 0, minio_safe_url: 0 });

  return {
    options,
    fallback_used: realOptions.length === 0,
    source_counts,
    production_actions_performed: false,
  };
}
