import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
} from '@/lib/product-video-preview-log';
import {
  appendProductVideoMockMediaMetadata,
  getProductVideoMediaMetadataLogPathForDiagnostics,
} from '@/lib/product-video-media-metadata';

export const dynamic = 'force-dynamic';

interface MediaMetadataBody {
  preview_id?: unknown;
  media_type?: unknown;
  public_media_url?: unknown;
  media_checksum?: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ previewId?: string }> },
) {
  const { previewId: rawPreviewId } = await params;
  const previewId = cleanText(rawPreviewId);

  if (!previewId) {
    return NextResponse.json(
      { ok: false, error: 'preview_id_required', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status: 400 },
    );
  }

  let body: MediaMetadataBody;
  try {
    body = await request.json() as MediaMetadataBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status: 400 },
    );
  }

  try {
    const bodyPreviewId = cleanText(body.preview_id);
    if (bodyPreviewId && bodyPreviewId !== previewId) {
      return NextResponse.json(
        { ok: false, error: 'preview_id_mismatch', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 400 },
      );
    }

    const item = await findProductVideoPreviewLogById(previewId);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'preview_log_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 },
      );
    }

    const metadata = await appendProductVideoMockMediaMetadata({
      previewId,
      mediaType: body.media_type,
      publicMediaUrl: body.public_media_url,
      mediaChecksum: body.media_checksum,
    });

    return NextResponse.json({
      ok: true,
      local_only: true,
      mock_metadata_only: true,
      metadata,
      publish_allowed: false,
      real_posting_enabled: false,
      facebook_post_performed: false,
      line_broadcast_performed: false,
      schedule_enabled: false,
      renderer_called: false,
      phaya_called: false,
      s3_upload_performed: false,
      mark_posted_performed: false,
      storage: {
        media_metadata_log_path: getProductVideoMediaMetadataLogPathForDiagnostics(),
      },
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'media_metadata_failed';

    if (status >= 500) {
      console.error('[product-video] media metadata failed', error);
    }

    return NextResponse.json(
      { ok: false, error: code, ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status },
    );
  }
}
