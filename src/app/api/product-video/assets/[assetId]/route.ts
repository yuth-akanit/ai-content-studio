import { readFile } from 'node:fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import { PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS } from '@/lib/product-video-preview-log';
import {
  findProductVideoUploadedAsset,
  getMediaContentTypeForFilename,
  isSafeProductVideoAssetId,
} from '@/lib/product-video-assets';

export const dynamic = 'force-dynamic';

type AssetRouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_request: NextRequest, context: AssetRouteContext) {
  const { assetId } = await context.params;
  const cleanAssetId = String(assetId || '').trim();

  if (!cleanAssetId || !isSafeProductVideoAssetId(cleanAssetId)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'asset_not_found',
        message: 'Uploaded image asset was not found',
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 404 },
    );
  }

  const metadata = await findProductVideoUploadedAsset(cleanAssetId);
  if (!metadata) {
    return NextResponse.json(
      {
        ok: false,
        error: 'asset_not_found',
        message: 'Uploaded image asset was not found',
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 404 },
    );
  }

  const contentType = metadata.mime_type.startsWith('image/') || metadata.mime_type.startsWith('video/')
    ? metadata.mime_type
    : getMediaContentTypeForFilename(metadata.saved_filename, 'application/octet-stream');

  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return NextResponse.json(
      {
        ok: false,
        error: 'asset_not_found',
        message: 'Uploaded image asset was not found',
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 404 },
    );
  }

  const buffer = await readFile(metadata.local_asset_path);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'public, max-age=3600, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
