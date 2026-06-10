import type { MasterVerticalVideo } from '@/lib/short-video-distribution/planner';

export type MediaComposerSourceType = 'image_pair' | 'raw_video';

export type MediaComposerSourceBadge = 'sample' | 'product_video_preview_log' | 'uploaded_asset' | 'minio_safe_url';

export type MediaComposerAudioMixMode = 'voiceover_only' | 'duck_original_with_voiceover' | 'original_only';

export type MediaComposerBaseInput = {
  source_type: MediaComposerSourceType;
  tts_script: string;
  cta_banner?: string;
  brand?: string;
  source_id?: string;
  source_badge?: MediaComposerSourceBadge;
  voiceover_audio_url?: string;
  voiceover_enabled?: boolean;
  audio_mix_mode?: MediaComposerAudioMixMode;
};

export type MediaComposerImagePairInput = MediaComposerBaseInput & {
  source_type: 'image_pair';
  before_image_url: string;
  after_image_url: string;
};

export type MediaComposerRawVideoInput = MediaComposerBaseInput & {
  source_type: 'raw_video';
  raw_video_url: string;
};

export type MediaComposerInput = MediaComposerImagePairInput | MediaComposerRawVideoInput;

export type MediaComposerRenderStep = {
  name: string;
  status: 'planned' | 'rendered_sample' | 'rendered';
  detail: string;
};

export type MediaComposerVisibleOverlays = {
  title_overlay: boolean;
  cta_banner: boolean;
  subtitle_burn_in: boolean;
};

export type MediaComposerMasterVideoOverrides = {
  master_video_url?: string;
  duration_seconds?: number;
  render_mode?: 'sample_fixture' | 'raw_video_passthrough_preview' | 'composed_preview_mp4';
  renderer_status?: 'not_requested' | 'rendered' | 'renderer_missing' | 'render_failed';
  fallback_used?: boolean;
  master_video_url_is_original_upload?: boolean;
  visible_overlays?: MediaComposerVisibleOverlays;
  raw_video_asset_id?: string;
  voiceover_asset_id?: string | null;
  final_master_video_asset_id?: string;
  final_master_video_url?: string;
  generated_voiceover_used?: boolean;
  voiceover_audio_used?: boolean;
  audio_expectation?: 'required' | 'optional';
};

export type MediaComposerMasterVideoRecord = {
  id: string;
  record_type: 'master_video';
  master_video_url: string;
  final_master_video_url: string;
  raw_video_asset_id?: string;
  voiceover_asset_id?: string | null;
  final_master_video_asset_id?: string;
  asset_role?: 'final_master_video';
  generated_voiceover_used?: boolean;
  voiceover_audio_used?: boolean;
  audio_expectation?: 'required' | 'optional';
  duration_seconds: number;
  source_type: MediaComposerSourceType;
  tts_script: string;
  ready_for_distribution_preview: true;
  approval_status: 'approved';
  asset_type: 'vertical_mp4';
  aspect_ratio: '9:16';
  brand: string;
  title: string;
  service: string;
  service_area: string;
  value_prop: string;
  cta: string;
  language: 'th-TH';
  tags: string[];
  hook: string;
  visual_notes: string;
  creative_angle: string;
  source_badge: MediaComposerSourceBadge;
  source_id?: string;
  composer_mode: 'preview_render_only';
  render_steps: MediaComposerRenderStep[];
  publish_flags: {
    facebook_publish_enabled: false;
    instagram_publish_enabled: false;
    tiktok_publish_enabled: false;
    youtube_publish_enabled: false;
    line_broadcast_enabled: false;
    scheduler_enabled: false;
    production_actions_performed: false;
  };
  source_assets: {
    before_image_url?: string;
    after_image_url?: string;
    raw_video_url?: string;
    voiceover_audio_url?: string;
    voiceover_enabled?: boolean;
    audio_mix_mode?: MediaComposerAudioMixMode;
  };
  render_mode: 'sample_fixture' | 'raw_video_passthrough_preview' | 'composed_preview_mp4';
  renderer_status: 'not_requested' | 'rendered' | 'renderer_missing' | 'render_failed';
  fallback_used: boolean;
  master_video_url_is_original_upload: boolean;
  visible_overlays: MediaComposerVisibleOverlays;
};

const SAMPLE_MASTER_VIDEO_URL = '/samples/media-composer-paa-image-pair-master.mp4';

const DEFAULT_TTS_SCRIPT = 'แอร์ไม่เย็น มีกลิ่นอับ หรือฝุ่นจับหนา... ให้ PA Air Service ช่วยดูแล ล้างสะอาด เห็นผลก่อนและหลังชัดเจน ทักเพื่อจองคิวได้เลย';
const DEFAULT_CTA = 'ทัก PA Air Service เพื่อจองคิวล้างแอร์';

function cleanText(value: unknown, fallback: string): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function isHttpOrLocalUrl(value: string): boolean {
  if (value.startsWith('/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateMediaComposerInput(input: MediaComposerInput): string[] {
  const errors: string[] = [];
  if (input.source_type !== 'image_pair' && input.source_type !== 'raw_video') {
    errors.push('source_type must be image_pair or raw_video');
  }
  if (!cleanText(input.tts_script, '')) errors.push('tts_script is required');

  if (input.source_type === 'image_pair') {
    if (!isHttpOrLocalUrl(input.before_image_url || '')) errors.push('before_image_url must be http(s) or local path');
    if (!isHttpOrLocalUrl(input.after_image_url || '')) errors.push('after_image_url must be http(s) or local path');
  }

  if (input.source_type === 'raw_video') {
    if (!isHttpOrLocalUrl(input.raw_video_url || '')) errors.push('raw_video_url must be http(s) or local path');
  }

  if (input.audio_mix_mode && !['voiceover_only', 'duck_original_with_voiceover', 'original_only'].includes(input.audio_mix_mode)) {
    errors.push('audio_mix_mode must be voiceover_only, duck_original_with_voiceover, or original_only');
  }

  return errors;
}

export function buildMediaComposerMasterVideoRecord(input: MediaComposerInput, overrides: MediaComposerMasterVideoOverrides = {}): MediaComposerMasterVideoRecord {
  const errors = validateMediaComposerInput(input);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  const brand = cleanText(input.brand, 'PA Air Service');
  const cta = cleanText(input.cta_banner, DEFAULT_CTA);
  const ttsScript = cleanText(input.tts_script, DEFAULT_TTS_SCRIPT);
  const isImagePair = input.source_type === 'image_pair';
  const isRawVideoPassthrough = input.source_type === 'raw_video'
    && !input.raw_video_url.startsWith('/samples/');
  const masterVideoUrl = overrides.master_video_url || (isRawVideoPassthrough ? input.raw_video_url : SAMPLE_MASTER_VIDEO_URL);
  const renderMode = overrides.render_mode || (isRawVideoPassthrough ? 'raw_video_passthrough_preview' : 'sample_fixture');
  const isOriginalUploadUrl = input.source_type === 'raw_video' && masterVideoUrl === input.raw_video_url;

  return {
    id: `master_video_media_composer_${input.source_type}_preview_001`,
    record_type: 'master_video',
    master_video_url: masterVideoUrl,
    final_master_video_url: overrides.final_master_video_url || masterVideoUrl,
    raw_video_asset_id: overrides.raw_video_asset_id,
    voiceover_asset_id: overrides.voiceover_asset_id,
    final_master_video_asset_id: overrides.final_master_video_asset_id,
    asset_role: overrides.final_master_video_asset_id ? 'final_master_video' : undefined,
    generated_voiceover_used: overrides.generated_voiceover_used,
    voiceover_audio_used: overrides.voiceover_audio_used,
    audio_expectation: overrides.audio_expectation,
    duration_seconds: overrides.duration_seconds || 5.4,
    source_type: input.source_type,
    tts_script: ttsScript,
    ready_for_distribution_preview: true,
    approval_status: 'approved',
    asset_type: 'vertical_mp4',
    aspect_ratio: '9:16',
    brand,
    title: isImagePair
      ? 'Before/After ล้างแอร์ PA Air Service'
      : isRawVideoPassthrough
        ? (renderMode === 'composed_preview_mp4' ? 'composed_preview_mp4' : 'raw_video_passthrough_preview')
        : 'Raw Video รีเฟรมเป็นคลิปแนวตั้ง PA Air Service',
    service: 'ล้างแอร์บ้าน',
    service_area: 'สมุทรปราการ',
    value_prop: 'แปลงไฟล์ต้นทางให้เป็น master video แนวตั้งพร้อมเสียง TTS ซับไตเติล และ CTA สำหรับตรวจทานก่อนกระจายคลิป',
    cta,
    language: 'th-TH',
    tags: ['PAA Air Service', 'ล้างแอร์', 'ช่างแอร์', 'BeforeAfter', 'ShortVideo'],
    hook: 'เห็นความต่างก่อนและหลังล้างแอร์',
    visual_notes: isImagePair
      ? 'Image pair mode: render 1080x1920 MP4 with pan/zoom before shot, crossfade, after shot, PA Air Service branding, subtitles, and CTA banner.'
      : 'Raw video mode: normalize source video to 9:16, remove original source audio by default, use narration-only voiceover audio, subtitles, PA Air Service branding, and CTA banner.',
    creative_angle: 'ใช้หลักฐานก่อน-หลังและคำพูดธรรมชาติภาษาไทยเพื่อให้เจ้าของตรวจ master video ก่อนส่งไปหน้า Short Video Distribution',
    source_badge: input.source_badge || 'sample',
    source_id: input.source_id,
    composer_mode: 'preview_render_only',
    render_steps: isImagePair
      ? [
          { name: 'input_model', status: 'planned', detail: 'source_type=image_pair with before_image_url and after_image_url' },
          { name: 'vertical_canvas', status: 'rendered_sample', detail: '1080x1920 MP4 sample rendered locally' },
          { name: 'motion', status: 'rendered_sample', detail: 'pan/zoom timing and crossfade transition represented in the master plan' },
          { name: 'branding_cta', status: 'rendered_sample', detail: 'PA Air Service branding and CTA banner included' },
        ]
      : [
          { name: 'input_model', status: 'planned', detail: 'source_type=raw_video with raw_video_url' },
          {
            name: renderMode === 'composed_preview_mp4' ? 'composed_preview_mp4' : (isRawVideoPassthrough ? 'raw_video_passthrough_preview' : 'normalize_9_16'),
            status: renderMode === 'composed_preview_mp4' ? 'rendered' : (isRawVideoPassthrough ? 'rendered_sample' : 'planned'),
            detail: isRawVideoPassthrough
              ? (renderMode === 'composed_preview_mp4'
                  ? 'uploaded raw_video was composed into a new preview MP4 with 9:16 canvas, title overlay, burned-in subtitle text, and bottom CTA banner; no /samples fallback used'
                  : 'real raw_video_url is passed through as master_video_url for manual preview; no /samples fallback used')
              : 'center crop/scale raw footage to vertical 1080x1920',
          },
          { name: 'audio_mix', status: 'planned', detail: 'voiceover_only by default: remove original/raw source audio and use narration-only voiceover track' },
          { name: 'subtitles_cta', status: 'planned', detail: 'subtitle and CTA banner overlay prepared for preview render' },
        ],
    publish_flags: {
      facebook_publish_enabled: false,
      instagram_publish_enabled: false,
      tiktok_publish_enabled: false,
      youtube_publish_enabled: false,
      line_broadcast_enabled: false,
      scheduler_enabled: false,
      production_actions_performed: false,
    },
    source_assets: isImagePair
      ? {
          before_image_url: input.before_image_url,
          after_image_url: input.after_image_url,
        }
      : {
          raw_video_url: input.raw_video_url,
          voiceover_audio_url: input.voiceover_audio_url,
          voiceover_enabled: input.voiceover_enabled,
          audio_mix_mode: input.audio_mix_mode,
        },
    render_mode: renderMode,
    renderer_status: overrides.renderer_status || 'not_requested',
    fallback_used: overrides.fallback_used ?? (!isRawVideoPassthrough),
    master_video_url_is_original_upload: overrides.master_video_url_is_original_upload ?? isOriginalUploadUrl,
    visible_overlays: overrides.visible_overlays || {
      title_overlay: renderMode === 'composed_preview_mp4',
      cta_banner: renderMode === 'composed_preview_mp4',
      subtitle_burn_in: renderMode === 'composed_preview_mp4',
    },
  };
}

export const sampleMediaComposerImagePairInput: MediaComposerImagePairInput = {
  source_type: 'image_pair',
  before_image_url: '/samples/before-cleaning-placeholder.jpg',
  after_image_url: '/samples/after-cleaning-placeholder.jpg',
  tts_script: DEFAULT_TTS_SCRIPT,
  cta_banner: DEFAULT_CTA,
  brand: 'PA Air Service',
};

export const sampleMediaComposerRawVideoInput: MediaComposerRawVideoInput = {
  source_type: 'raw_video',
  raw_video_url: '/samples/raw-air-cleaning-placeholder.mp4',
  tts_script: DEFAULT_TTS_SCRIPT,
  cta_banner: DEFAULT_CTA,
  brand: 'PA Air Service',
};

export const sampleMediaComposerMasterVideoRecord = buildMediaComposerMasterVideoRecord(sampleMediaComposerImagePairInput);

export function toShortVideoMasterVerticalVideo(record: MediaComposerMasterVideoRecord): MasterVerticalVideo {
  return {
    id: record.id,
    approval_status: record.approval_status,
    asset_type: record.asset_type,
    video_url: record.master_video_url,
    duration_seconds: record.duration_seconds,
    aspect_ratio: record.aspect_ratio,
    brand: record.brand,
    title: record.title,
    service: record.service,
    service_area: record.service_area,
    value_prop: record.value_prop,
    cta: record.cta,
    language: record.language,
    tags: record.tags,
    hook: record.hook,
    visual_notes: record.visual_notes,
    creative_angle: record.creative_angle,
    youtube_privacy_status: 'unlisted',
  };
}
