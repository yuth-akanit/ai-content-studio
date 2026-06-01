import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  ProductVideoPreviewSafetyFlags,
} from '@/lib/product-video-preview-log';

export type ProductVideoMediaStatus = 'ready';
export type ProductVideoMediaType = 'video' | 'image';
export type ProductVideoMediaSource = 'mock_metadata_only';

export interface ProductVideoMediaMetadataRecord extends ProductVideoPreviewSafetyFlags {
  metadata_id: string;
  preview_id: string;
  media_status: ProductVideoMediaStatus;
  media_type: ProductVideoMediaType;
  public_media_url: string;
  media_checksum: string;
  source: ProductVideoMediaSource;
  local_only: true;
  mock_metadata_only: true;
  real_posting_enabled: false;
  renderer_called: false;
  s3_upload_performed: false;
  facebook_post_performed: false;
  line_broadcast_performed: false;
  schedule_enabled: false;
  mark_posted_performed: false;
  created_at: string;
}

const DEFAULT_MEDIA_METADATA_LOG_PATH = '/app/runtime/product-video-media-metadata.jsonl';
const PUBLIC_MEDIA_URL_PREFIX = 'https://admin.paaair.online/media/';

function getMediaMetadataLogPath(): string {
  return process.env.PRODUCT_VIDEO_MEDIA_METADATA_LOG_PATH || DEFAULT_MEDIA_METADATA_LOG_PATH;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getProductVideoMediaMetadataLogPathForDiagnostics(): string {
  return getMediaMetadataLogPath();
}

export function parseProductVideoMediaType(value: unknown): ProductVideoMediaType | null {
  if (value === 'video' || value === 'image') return value;
  return null;
}

function parseMediaMetadataLine(line: string): ProductVideoMediaMetadataRecord | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!isRecord(parsed)) return null;
    if (typeof parsed.preview_id !== 'string') return null;
    if (parsed.media_status !== 'ready') return null;
    if (!parseProductVideoMediaType(parsed.media_type)) return null;
    if (typeof parsed.public_media_url !== 'string') return null;
    if (!parsed.public_media_url.startsWith(PUBLIC_MEDIA_URL_PREFIX)) return null;
    if (typeof parsed.media_checksum !== 'string' || !parsed.media_checksum.trim()) return null;
    if (parsed.source !== 'mock_metadata_only') return null;
    if (parsed.renderer_called !== false) return null;
    if (parsed.s3_upload_performed !== false) return null;
    if (parsed.facebook_post_performed !== false) return null;
    if (parsed.line_broadcast_performed !== false) return null;
    return parsed as unknown as ProductVideoMediaMetadataRecord;
  } catch {
    return null;
  }
}

export async function listProductVideoMediaMetadata(): Promise<ProductVideoMediaMetadataRecord[]> {
  const logPath = getMediaMetadataLogPath();
  try {
    const content = await readFile(logPath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .map(parseMediaMetadataLine)
      .filter((item): item is ProductVideoMediaMetadataRecord => Boolean(item));
  } catch {
    return [];
  }
}

export async function findLatestProductVideoMediaMetadata(
  previewId: string,
): Promise<ProductVideoMediaMetadataRecord | null> {
  const metadata = await listProductVideoMediaMetadata();
  return metadata
    .filter((item) => item.preview_id === previewId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null;
}

export async function appendProductVideoMockMediaMetadata(input: {
  previewId: string;
  mediaType: unknown;
  publicMediaUrl: unknown;
  mediaChecksum: unknown;
}): Promise<ProductVideoMediaMetadataRecord> {
  const previewId = cleanText(input.previewId);
  const mediaType = parseProductVideoMediaType(input.mediaType);
  const publicMediaUrl = cleanText(input.publicMediaUrl);
  const mediaChecksum = cleanText(input.mediaChecksum);

  if (!previewId) {
    throw Object.assign(new Error('preview_id_required'), { code: 'preview_id_required', status: 400 });
  }
  if (!mediaType) {
    throw Object.assign(new Error('invalid_media_type'), { code: 'invalid_media_type', status: 400 });
  }
  if (!publicMediaUrl.startsWith(PUBLIC_MEDIA_URL_PREFIX)) {
    throw Object.assign(new Error('invalid_public_media_url_prefix'), {
      code: 'invalid_public_media_url_prefix',
      status: 400,
    });
  }
  if (!mediaChecksum) {
    throw Object.assign(new Error('media_checksum_required'), { code: 'media_checksum_required', status: 400 });
  }

  const record: ProductVideoMediaMetadataRecord = {
    metadata_id: randomUUID(),
    preview_id: previewId,
    media_status: 'ready',
    media_type: mediaType,
    public_media_url: publicMediaUrl,
    media_checksum: mediaChecksum,
    source: 'mock_metadata_only',
    local_only: true,
    mock_metadata_only: true,
    real_posting_enabled: false,
    renderer_called: false,
    s3_upload_performed: false,
    facebook_post_performed: false,
    line_broadcast_performed: false,
    schedule_enabled: false,
    mark_posted_performed: false,
    created_at: new Date().toISOString(),
    publish_allowed: false,
    phaya_called: false,
  };

  const logPath = getMediaMetadataLogPath();
  await mkdir(path.dirname(logPath), { recursive: true });
  await writeFile(logPath, `${JSON.stringify(record)}\n`, { flag: 'a' });

  return record;
}
