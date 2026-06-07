import type { MasterVerticalVideo } from '@/lib/short-video-distribution/planner';

export type MediaComposerSourceType = 'image_pair' | 'raw_video';

export type MediaComposerBaseInput = {
  source_type: MediaComposerSourceType;
  tts_script: string;
  cta_banner?: string;
  brand?: string;
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
  status: 'planned' | 'rendered_sample';
  detail: string;
};

export type MediaComposerMasterVideoRecord = {
  id: string;
  record_type: 'master_video';
  master_video_url: string;
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
  };
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

  return errors;
}

export function buildMediaComposerMasterVideoRecord(input: MediaComposerInput): MediaComposerMasterVideoRecord {
  const errors = validateMediaComposerInput(input);
  if (errors.length) {
    throw new Error(errors.join('; '));
  }

  const brand = cleanText(input.brand, 'PA Air Service');
  const cta = cleanText(input.cta_banner, DEFAULT_CTA);
  const ttsScript = cleanText(input.tts_script, DEFAULT_TTS_SCRIPT);
  const isImagePair = input.source_type === 'image_pair';

  return {
    id: `master_video_media_composer_${input.source_type}_preview_001`,
    record_type: 'master_video',
    master_video_url: SAMPLE_MASTER_VIDEO_URL,
    duration_seconds: 5.4,
    source_type: input.source_type,
    tts_script: ttsScript,
    ready_for_distribution_preview: true,
    approval_status: 'approved',
    asset_type: 'vertical_mp4',
    aspect_ratio: '9:16',
    brand,
    title: isImagePair ? 'Before/After ล้างแอร์ PA Air Service' : 'Raw Video รีเฟรมเป็นคลิปแนวตั้ง PA Air Service',
    service: 'ล้างแอร์บ้าน',
    service_area: 'สมุทรปราการ',
    value_prop: 'แปลงไฟล์ต้นทางให้เป็น master video แนวตั้งพร้อมเสียง TTS ซับไตเติล และ CTA สำหรับตรวจทานก่อนกระจายคลิป',
    cta,
    language: 'th-TH',
    tags: ['PAA Air Service', 'ล้างแอร์', 'ช่างแอร์', 'BeforeAfter', 'ShortVideo'],
    hook: 'เห็นความต่างก่อนและหลังล้างแอร์',
    visual_notes: isImagePair
      ? 'Image pair mode: render 1080x1920 MP4 with pan/zoom before shot, crossfade, after shot, PA Air Service branding, subtitles, and CTA banner.'
      : 'Raw video mode: normalize source video to 9:16, reduce original audio, add Thai TTS script audio, subtitles, PA Air Service branding, and CTA banner.',
    creative_angle: 'ใช้หลักฐานก่อน-หลังและคำพูดธรรมชาติภาษาไทยเพื่อให้เจ้าของตรวจ master video ก่อนส่งไปหน้า Short Video Distribution',
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
          { name: 'normalize_9_16', status: 'planned', detail: 'center crop/scale raw footage to vertical 1080x1920' },
          { name: 'audio_mix', status: 'planned', detail: 'reduce original audio and use tts_script as primary voiceover' },
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
