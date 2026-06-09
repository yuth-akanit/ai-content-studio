import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRODUCT_VIDEO_UPLOAD_DIR = process.env.PRODUCT_VIDEO_UPLOAD_DIR || '/app/runtime/product-video-assets/uploads';
export const PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH = process.env.PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH || '/app/runtime/product-video-uploaded-assets.jsonl';

export interface ProductVideoUploadedAssetMetadata {
  asset_id: string;
  filename: string;
  saved_filename: string;
  mime_type: string;
  size_bytes: number;
  local_asset_path: string;
  public_image_url: string;
  public_media_url: string;
  image_urls: string[];
  media_urls: string[];
  media_type: 'image' | 'video' | 'audio';
  uploaded_at: string;
  source_badge?: 'uploaded_asset' | 'generated_voiceover';
  tts_provider?: 'mock' | 'elevenlabs' | 'google' | 'phaya';
  external_tts_calls_performed?: boolean;
}

const SAFE_ASSET_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,180}$/;
const IMAGE_EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
};
const VIDEO_EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.webm': 'video/webm',
};
const AUDIO_EXTENSION_CONTENT_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.webm': 'audio/webm',
};

export function cleanProductVideoFilename(name: string): string {
  const base = path.basename(name || 'uploaded_image');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function isSafeProductVideoAssetId(value: string): boolean {
  if (!SAFE_ASSET_ID_RE.test(value)) return false;
  if (value.includes('..') || value.includes('/') || value.includes('\\')) return false;
  return true;
}

export function getImageContentTypeForFilename(filename: string, fallback = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSION_CONTENT_TYPES[ext] || fallback;
}

export function getMediaContentTypeForFilename(filename: string, fallback = 'application/octet-stream'): string {
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSION_CONTENT_TYPES[ext] || VIDEO_EXTENSION_CONTENT_TYPES[ext] || AUDIO_EXTENSION_CONTENT_TYPES[ext] || fallback;
}

export function isSupportedProductVideoImageFilename(filename: string): boolean {
  return getImageContentTypeForFilename(filename) !== 'application/octet-stream';
}

export function isSupportedProductVideoMediaFilename(filename: string): boolean {
  return getMediaContentTypeForFilename(filename) !== 'application/octet-stream';
}

export function buildProductVideoPublicAssetUrl(request: Request, assetId: string): string {
  const configuredBase = (process.env.PRODUCT_VIDEO_PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  const origin = configuredBase || new URL(request.url).origin;
  return `${origin}/api/product-video/assets/${encodeURIComponent(assetId)}`;
}

export function createProductVideoUploadedAssetMetadata(input: {
  request: Request;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}): ProductVideoUploadedAssetMetadata {
  const originalFilename = cleanProductVideoFilename(input.originalFilename || 'uploaded_image');
  const ext = path.extname(originalFilename).toLowerCase() || '.png';
  const assetId = randomUUID();
  const savedFilename = `${assetId}${ext}`;
  const publicMediaUrl = buildProductVideoPublicAssetUrl(input.request, assetId);
  const mediaType: 'image' | 'video' | 'audio' = input.mimeType.startsWith('video/') ? 'video' : input.mimeType.startsWith('audio/') ? 'audio' : 'image';

  return {
    asset_id: assetId,
    filename: originalFilename,
    saved_filename: savedFilename,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    local_asset_path: getProductVideoUploadPathForFilename(savedFilename),
    public_image_url: publicMediaUrl,
    public_media_url: publicMediaUrl,
    image_urls: mediaType === 'image' ? [publicMediaUrl] : [],
    media_urls: [publicMediaUrl],
    media_type: mediaType,
    uploaded_at: new Date().toISOString(),
  };
}

export function getProductVideoUploadPathForFilename(filename: string): string {
  const uploadDir = path.resolve(PRODUCT_VIDEO_UPLOAD_DIR);
  const resolvedPath = path.resolve(uploadDir, filename);
  if (!resolvedPath.startsWith(uploadDir + path.sep)) {
    throw Object.assign(new Error('directory_traversal_detected'), { code: 'directory_traversal_detected' });
  }
  return resolvedPath;
}

export async function saveProductVideoUploadedAsset(metadata: ProductVideoUploadedAssetMetadata, buffer: Buffer): Promise<void> {
  const uploadDir = path.resolve(PRODUCT_VIDEO_UPLOAD_DIR);
  const resolvedPath = getProductVideoUploadPathForFilename(metadata.saved_filename);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(resolvedPath, buffer);
  await mkdir(path.dirname(PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH), { recursive: true });
  await writeFile(PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH, `${JSON.stringify(metadata)}\n`, { flag: 'a' });
}

function parseMetadataLine(line: string): ProductVideoUploadedAssetMetadata | null {
  try {
    const parsed = JSON.parse(line) as Partial<ProductVideoUploadedAssetMetadata>;
    if (typeof parsed.asset_id !== 'string') return null;
    if (typeof parsed.saved_filename !== 'string') return null;
    if (typeof parsed.mime_type !== 'string') return null;
    if (!isSafeProductVideoAssetId(parsed.asset_id)) return null;
    if (!isSafeProductVideoAssetId(parsed.saved_filename)) return null;
    if (!isSupportedProductVideoMediaFilename(parsed.saved_filename)) return null;
    const publicMediaUrl = typeof parsed.public_media_url === 'string'
      ? parsed.public_media_url
      : parsed.public_image_url;
    const mediaType: 'image' | 'video' | 'audio' = parsed.mime_type.startsWith('video/') ? 'video' : parsed.mime_type.startsWith('audio/') ? 'audio' : 'image';
    return {
      ...parsed,
      public_media_url: publicMediaUrl,
      media_urls: Array.isArray(parsed.media_urls) ? parsed.media_urls : [publicMediaUrl].filter(Boolean),
      media_type: parsed.media_type === 'video' || parsed.media_type === 'image' || parsed.media_type === 'audio' ? parsed.media_type : mediaType,
      source_badge: parsed.source_badge === 'generated_voiceover' ? 'generated_voiceover' : parsed.source_badge === 'uploaded_asset' ? 'uploaded_asset' : undefined,
      tts_provider: parsed.tts_provider === 'mock' || parsed.tts_provider === 'elevenlabs' || parsed.tts_provider === 'google' || parsed.tts_provider === 'phaya' ? parsed.tts_provider : undefined,
      external_tts_calls_performed: typeof parsed.external_tts_calls_performed === 'boolean' ? parsed.external_tts_calls_performed : undefined,
      image_urls: Array.isArray(parsed.image_urls) ? parsed.image_urls : (mediaType === 'image' ? [publicMediaUrl].filter(Boolean) : []),
    } as ProductVideoUploadedAssetMetadata;
  } catch {
    return null;
  }
}

export async function findProductVideoUploadedAsset(assetIdOrFilename: string): Promise<ProductVideoUploadedAssetMetadata | null> {
  const cleanAssetId = String(assetIdOrFilename || '').trim();
  if (!isSafeProductVideoAssetId(cleanAssetId)) return null;

  let content = '';
  try {
    content = await readFile(PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH, 'utf8');
  } catch {
    return null;
  }

  const records = content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(parseMetadataLine)
    .filter((record): record is ProductVideoUploadedAssetMetadata => Boolean(record));

  const match = [...records].reverse().find((record) => (
    record.asset_id === cleanAssetId || record.saved_filename === cleanAssetId
  ));

  if (!match) return null;
  let resolvedPath = match.local_asset_path;
  if (typeof resolvedPath !== 'string' || resolvedPath.trim().length === 0) {
    resolvedPath = getProductVideoUploadPathForFilename(match.saved_filename);
  }
  try {
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) return null;
  } catch {
    resolvedPath = getProductVideoUploadPathForFilename(match.saved_filename);
    try {
      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) return null;
    } catch {
      return null;
    }
  }

  return {
    ...match,
    local_asset_path: resolvedPath,
    mime_type: match.mime_type.startsWith('image/') || match.mime_type.startsWith('video/') || match.mime_type.startsWith('audio/')
      ? match.mime_type
      : getMediaContentTypeForFilename(match.saved_filename, 'application/octet-stream'),
  };
}
