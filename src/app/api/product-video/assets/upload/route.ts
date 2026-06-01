import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS } from '@/lib/product-video-preview-log';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = '/app/runtime/product-video-assets/uploads';
const METADATA_LOG_PATH = '/app/runtime/product-video-uploaded-assets.jsonl';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function cleanFilename(name: string): string {
  // Use path.basename to strip directory components
  const base = path.basename(name);
  // Keep only safe characters: alphanumeric, dots, dashes, underscores
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'no_file_uploaded',
          message: 'No file was provided in the upload request',
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 }
      );
    }

    const mimeType = file.type || '';
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_mime_type',
          message: 'Only image uploads are permitted (e.g. PNG, JPEG, WEBP)',
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: 'file_too_large',
          message: `File exceeds the maximum limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 }
      );
    }

    const originalFilename = cleanFilename(file.name || 'uploaded_image');
    const ext = path.extname(originalFilename) || '.png';
    const assetId = randomUUID();
    const savedFilename = `${assetId}${ext}`;
    const localAssetPath = path.join(UPLOAD_DIR, savedFilename);

    // Strict path verification to ensure no directory traversal
    const resolvedPath = path.resolve(localAssetPath);
    const resolvedUploadDir = path.resolve(UPLOAD_DIR);
    if (!resolvedPath.startsWith(resolvedUploadDir + path.sep)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'directory_traversal_detected',
          message: 'Invalid path generation detected',
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 400 }
      );
    }

    // Read buffer and save file
    const buffer = Buffer.from(await file.arrayBuffer());
    await mkdir(resolvedUploadDir, { recursive: true });
    await writeFile(resolvedPath, buffer);

    // Save metadata in JSONL log
    const metadata = {
      asset_id: assetId,
      filename: originalFilename,
      saved_filename: savedFilename,
      mime_type: mimeType,
      size_bytes: file.size,
      local_asset_path: resolvedPath,
      uploaded_at: new Date().toISOString(),
    };

    await mkdir(path.dirname(METADATA_LOG_PATH), { recursive: true });
    await writeFile(METADATA_LOG_PATH, `${JSON.stringify(metadata)}\n`, { flag: 'a' });

    return NextResponse.json({
      ok: true,
      asset_id: assetId,
      filename: originalFilename,
      mime_type: mimeType,
      size_bytes: file.size,
      local_asset_path: resolvedPath,
      public_image_url: null,
      explanation: 'Public image serving is not configured for runtime uploaded assets. Files are stored locally in the container filesystem.',
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    });
  } catch (error) {
    console.error('[product-video-assets] upload failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'upload_failed',
        message: error instanceof Error ? error.message : String(error),
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 500 }
    );
  }
}
