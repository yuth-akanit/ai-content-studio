import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PRODUCT_VIDEO_UPLOAD_DIR = '/app/runtime/product-video-assets/uploads';
export const PRODUCT_VIDEO_ASSET_METADATA_LOG_PATH = '/app/runtime/product-video-uploaded-assets.jsonl';

export interface ProductVideoUploadedAssetMetadata {
  asset_id: string;
  filename: string;
  saved_filename: string;
  mime_type: string;
  size_bytes: number;
  local_asset_path: string;
  public_image_url: string;
  image_urls: string[];
  uploaded_at: string;
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

export function isSupportedProductVideoImageFilename(filename: string): boolean {
  return getImageContentTypeForFilename(filename) !== 'application/octet-stream';
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
  const publicImageUrl = buildProductVideoPublicAssetUrl(input.request, assetId);

  return {
    asset_id: assetId,
    filename: originalFilename,
    saved_filename: savedFilename,
    mime_type: input.mimeType,
    size_bytes: input.sizeBytes,
    local_asset_path: getProductVideoUploadPathForFilename(savedFilename),
    public_image_url: publicImageUrl,
    image_urls: [publicImageUrl],
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
    if (!isSupportedProductVideoImageFilename(parsed.saved_filename)) return null;
    return parsed as ProductVideoUploadedAssetMetadata;
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
  const resolvedPath = getProductVideoUploadPathForFilename(match.saved_filename);
  try {
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) return null;
  } catch {
    return null;
  }

  return {
    ...match,
    local_asset_path: resolvedPath,
    mime_type: match.mime_type.startsWith('image/')
      ? match.mime_type
      : getImageContentTypeForFilename(match.saved_filename, 'image/png'),
  };
}
