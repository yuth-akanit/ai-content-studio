import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
  updateProductVideoPreviewLog,
} from '@/lib/product-video-preview-log';
import { findLatestProductVideoMediaMetadata } from '@/lib/product-video-media-metadata';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId?: string }> },
) {
  const { jobId: rawJobId } = await params;
  const jobId = cleanText(rawJobId);

  if (!jobId) {
    return NextResponse.json(
      { ok: false, error: 'job_id_required', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status: 400 }
    );
  }

  try {
    // Extract preview ID from jobId (job-UUID format)
    const previewId = jobId.startsWith('job-') ? jobId.slice(4) : jobId;
    const item = await findProductVideoPreviewLogById(previewId);

    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'preview_log_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 }
      );
    }

    const metadata = await findLatestProductVideoMediaMetadata(previewId);
    const hasFixture = Boolean(metadata);
    const status = hasFixture ? 'mock_render_ready' : 'render_pending';

    if (hasFixture && metadata) {
      await updateProductVideoPreviewLog(previewId, {
        render_status: status,
        public_media_url: metadata.public_media_url,
        media_checksum: metadata.media_checksum,
        media_status: 'ready',
        media_type: metadata.media_type,
      });
    }

    return NextResponse.json({
      ok: true,
      job_id: jobId,
      status,
      mock_render: true,
      public_media_url: metadata?.public_media_url || null,
      media_type: metadata?.media_type || 'video',
      media_checksum: metadata?.media_checksum || null,
      error: null,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    });
  } catch (error) {
    console.error('[product-video-render] status check failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'render_status_failed',
        message: error instanceof Error ? error.message : String(error),
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 500 }
    );
  }
}
