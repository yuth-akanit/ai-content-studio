import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
  updateProductVideoPreviewLog,
} from '@/lib/product-video-preview-log';
import { findLatestProductVideoMediaMetadata } from '@/lib/product-video-media-metadata';
import { validatePublicMediaUrl } from '@/lib/product-video-render-adapter';

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
    const mediaUrl = metadata?.public_media_url || item.public_media_url;
    const mediaChecksum = metadata?.media_checksum || item.media_checksum;
    const mediaType = metadata?.media_type || item.media_type || 'video';

    if (mediaUrl) {
      // Validate URL HTTP 200/206
      const validation = await validatePublicMediaUrl(mediaUrl);
      if (!validation.ok) {
        return NextResponse.json(
          {
            ok: false,
            error: 'media_url_validation_failed',
            message: `Public media URL validation failed: ${validation.error}`,
            job_id: jobId,
            status: 'render_pending',
            public_media_url: mediaUrl,
            ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
          },
          { status: 400 }
        );
      }

      await updateProductVideoPreviewLog(previewId, {
        render_status: 'mock_render_ready',
        public_media_url: mediaUrl,
        media_checksum: mediaChecksum || `md5-${previewId}`,
        media_status: 'ready',
        media_type: mediaType,
      });

      return NextResponse.json({
        ok: true,
        job_id: jobId,
        status: 'mock_render_ready',
        public_media_url: mediaUrl,
        media_type: mediaType,
        media_checksum: mediaChecksum || `md5-${previewId}`,
        error: null,
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        mock_render: !item.renderer_called,
        renderer_called: Boolean(item.renderer_called),
      });
    }

    return NextResponse.json({
      ok: true,
      job_id: jobId,
      status: 'render_pending',
      public_media_url: null,
      media_type: 'video',
      media_checksum: null,
      error: null,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      mock_render: !item.renderer_called,
      renderer_called: Boolean(item.renderer_called),
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
