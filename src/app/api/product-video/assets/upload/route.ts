import { NextRequest, NextResponse } from 'next/server';
import { PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS } from '@/lib/product-video-preview-log';
import {
  createProductVideoUploadedAssetMetadata,
  saveProductVideoUploadedAsset,
} from '@/lib/product-video-assets';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

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

    const metadata = createProductVideoUploadedAssetMetadata({
      request,
      originalFilename: file.name || 'uploaded_image',
      mimeType,
      sizeBytes: file.size,
    });

    const buffer = Buffer.from(await file.arrayBuffer());
    await saveProductVideoUploadedAsset(metadata, buffer);

    return NextResponse.json({
      ok: true,
      asset_id: metadata.asset_id,
      uploaded_asset_id: metadata.asset_id,
      filename: metadata.filename,
      mime_type: metadata.mime_type,
      size_bytes: metadata.size_bytes,
      local_asset_path: metadata.local_asset_path,
      public_image_url: metadata.public_image_url,
      image_urls: metadata.image_urls,
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
