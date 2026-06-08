import { randomUUID } from 'node:crypto';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  buildProductVideoPublicAssetUrl,
  findProductVideoUploadedAsset,
  getProductVideoUploadPathForFilename,
  PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH,
  type ProductVideoUploadedAssetMetadata,
} from '@/lib/product-video-assets';
import type { MediaComposerRawVideoInput } from '@/lib/media-composer';

const execFileAsync = promisify(execFile);
const OUTPUT_MIME_TYPE = 'video/mp4';
const OUTPUT_EXTENSION = '.mp4';
const MAX_OVERLAY_TEXT_CHARS = 90;

type RawVideoRendererStatus = 'rendered' | 'renderer_missing' | 'source_not_uploaded_asset' | 'render_failed';

export type RawVideoRenderResult = {
  ok: true;
  module: 'media_composer_real_render_v2';
  status: RawVideoRendererStatus;
  render_mode: 'composed_preview_mp4';
  asset_id: string;
  saved_filename: string;
  local_asset_path: string;
  public_media_url: string;
  duration_seconds: number;
  source_badge: 'uploaded_asset';
  source_type: 'raw_video';
  master_video_url_is_original_upload: false;
  master_video_url_is_sample: false;
  fallback_used: false;
  visible_overlays: {
    title_overlay: true;
    cta_banner: true;
    subtitle_burn_in: true;
  };
};

export type RawVideoRenderBlocked = {
  ok: false;
  module: 'media_composer_real_render_v2';
  status: Exclude<RawVideoRendererStatus, 'rendered'>;
  error: string;
  message: string;
  source_badge: 'uploaded_asset';
  source_type: 'raw_video';
  fallback_used: false;
  all_publish_flags_false: true;
  external_api_calls_performed: false;
  production_actions_performed: false;
};

function cleanOverlayText(value: unknown, fallback: string): string {
  const text = String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (text || fallback).slice(0, MAX_OVERLAY_TEXT_CHARS);
}

function extractProductVideoAssetId(publicUrl: string): string | null {
  try {
    const parsed = new URL(publicUrl, 'http://localhost');
    const marker = '/api/product-video/assets/';
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const encodedId = parsed.pathname.slice(index + marker.length).split('/')[0];
    return decodeURIComponent(encodedId || '').trim() || null;
  } catch {
    return null;
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function ffprobeDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    filePath,
  ], { timeout: 15000 });
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Number(duration.toFixed(2));
}

function buildOutputMetadata(request: Request, original: ProductVideoUploadedAssetMetadata): ProductVideoUploadedAssetMetadata {
  const assetId = randomUUID();
  const savedFilename = `${assetId}${OUTPUT_EXTENSION}`;
  const publicMediaUrl = buildProductVideoPublicAssetUrl(request, assetId);
  return {
    asset_id: assetId,
    filename: `media-composer-real-render-v2-${original.asset_id}${OUTPUT_EXTENSION}`,
    saved_filename: savedFilename,
    mime_type: OUTPUT_MIME_TYPE,
    size_bytes: 0,
    local_asset_path: getProductVideoUploadPathForFilename(savedFilename),
    public_image_url: publicMediaUrl,
    public_media_url: publicMediaUrl,
    image_urls: [],
    media_urls: [publicMediaUrl],
    media_type: 'video',
    uploaded_at: new Date().toISOString(),
  };
}

async function appendRenderedMetadata(metadata: ProductVideoUploadedAssetMetadata, sizeBytes: number): Promise<void> {
  const finalMetadata = { ...metadata, size_bytes: sizeBytes };
  await mkdir(path.dirname(PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH), { recursive: true });
  await appendFile(PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH, `${JSON.stringify(finalMetadata)}\n`);
}

async function writeOverlayTextFiles(workDir: string, input: MediaComposerRawVideoInput): Promise<{ title: string; cta: string; subtitle: string }> {
  const title = path.join(workDir, 'title.txt');
  const cta = path.join(workDir, 'cta.txt');
  const subtitle = path.join(workDir, 'subtitle.txt');
  await writeFile(title, cleanOverlayText(input.brand, 'ล้างแอร์ พีเอเอ'));
  await writeFile(cta, cleanOverlayText(input.cta_banner, 'จองคิวล้างแอร์กับพีเอเอ'));
  await writeFile(subtitle, cleanOverlayText(input.tts_script, 'พรีวิวคลิปสำหรับตรวจทานก่อนเผยแพร่'));
  return { title, cta, subtitle };
}

function drawText(textFile: string, y: string, fontSize: number): string {
  return `drawtext=fontfile=/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf:textfile='${textFile.replace(/'/g, "'\\''")}':fontcolor=white:fontsize=${fontSize}:x=(w-text_w)/2:y=${y}:box=1:boxcolor=black@0.92:boxborderw=18`;
}

async function runFfmpegCompose(inputPath: string, outputPath: string, textFiles: { title: string; cta: string; subtitle: string }): Promise<void> {
  const filter = [
    'scale=1080:1920:force_original_aspect_ratio=decrease',
    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x111827',
    'drawbox=x=0:y=0:w=1080:h=220:color=0x111827@1.0:t=fill',
    drawText(textFiles.title, '54', 54),
    drawText(textFiles.subtitle, '1240', 42),
    'drawbox=x=0:y=1360:w=1080:h=560:color=0x111827@1.0:t=fill',
    drawText(textFiles.cta, '1580', 52),
  ].join(',');

  await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-vf',
    filter,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    '-shortest',
    outputPath,
  ], { timeout: 180000, maxBuffer: 1024 * 1024 * 4 });
}

export async function renderUploadedRawVideoPreview(input: MediaComposerRawVideoInput, request: Request): Promise<RawVideoRenderResult | RawVideoRenderBlocked> {
  const module = 'media_composer_real_render_v2' as const;
  const blockedBase = {
    ok: false as const,
    module,
    source_badge: 'uploaded_asset' as const,
    source_type: 'raw_video' as const,
    fallback_used: false as const,
    all_publish_flags_false: true as const,
    external_api_calls_performed: false as const,
    production_actions_performed: false as const,
  };

  const hasFfmpeg = await commandExists('ffmpeg');
  const hasFfprobe = await commandExists('ffprobe');
  if (!hasFfmpeg || !hasFfprobe) {
    return {
      ...blockedBase,
      status: 'renderer_missing',
      error: 'renderer_missing',
      message: 'ffmpeg/ffprobe is required for composed raw video preview render but was not found',
    };
  }

  const assetId = extractProductVideoAssetId(input.raw_video_url);
  if (!assetId) {
    return {
      ...blockedBase,
      status: 'source_not_uploaded_asset',
      error: 'source_not_uploaded_asset',
      message: 'Uploaded raw_video render requires a /api/product-video/assets/{assetId} URL',
    };
  }

  const original = await findProductVideoUploadedAsset(assetId);
  if (!original || original.media_type !== 'video') {
    return {
      ...blockedBase,
      status: 'source_not_uploaded_asset',
      error: 'source_not_uploaded_asset',
      message: 'Uploaded raw video asset metadata was not found',
    };
  }

  const output = buildOutputMetadata(request, original);
  const outputDir = path.dirname(output.local_asset_path);
  const workDir = path.join(outputDir, `media-composer-real-render-v2-${output.asset_id}`);
  try {
    await mkdir(outputDir, { recursive: true });
    await mkdir(workDir, { recursive: true });
    const textFiles = await writeOverlayTextFiles(workDir, input);
    await runFfmpegCompose(original.local_asset_path, output.local_asset_path, textFiles);
    const durationSeconds = await ffprobeDurationSeconds(output.local_asset_path);
    const { size } = await import('node:fs/promises').then(({ stat }) => stat(output.local_asset_path));
    await appendRenderedMetadata(output, size);

    return {
      ok: true,
      module,
      status: 'rendered',
      render_mode: 'composed_preview_mp4',
      asset_id: output.asset_id,
      saved_filename: output.saved_filename,
      local_asset_path: output.local_asset_path,
      public_media_url: output.public_media_url,
      duration_seconds: durationSeconds,
      source_badge: 'uploaded_asset',
      source_type: 'raw_video',
      master_video_url_is_original_upload: false,
      master_video_url_is_sample: false,
      fallback_used: false,
      visible_overlays: {
        title_overlay: true,
        cta_banner: true,
        subtitle_burn_in: true,
      },
    };
  } catch (error) {
    return {
      ...blockedBase,
      status: 'render_failed',
      error: 'render_failed',
      message: error instanceof Error ? error.message : 'Unknown ffmpeg render failure',
    };
  }
}
