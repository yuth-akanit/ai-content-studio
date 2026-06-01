import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
  updateProductVideoPreviewLog,
} from '@/lib/product-video-preview-log';
import { findLatestProductVideoMediaMetadata } from '@/lib/product-video-media-metadata';

export const dynamic = 'force-dynamic';

interface RenderRequestBody {
  preview_id?: unknown;
  brand_context?: unknown;
  asset_id?: unknown;
  brief?: unknown;
  marketing_caption?: unknown;
  scene_script?: unknown;
  overlay_texts?: unknown;
  selected_pages?: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: NextRequest) {
  try {
    let body: RenderRequestBody;
    try {
      body = await request.json() as RenderRequestBody;
    } catch {
      return NextResponse.json(
        { ok: false, error: 'invalid_json', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 400 }
      );
    }

    const previewId = cleanText(body.preview_id);
    if (!previewId) {
      return NextResponse.json(
        { ok: false, error: 'preview_id_required', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 400 }
      );
    }

    const item = await findProductVideoPreviewLogById(previewId);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'preview_log_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 }
      );
    }

    const jobId = `job-${previewId}`;
    const metadata = await findLatestProductVideoMediaMetadata(previewId);
    const hasFixture = Boolean(metadata);
    const status = hasFixture ? 'mock_render_ready' : 'render_pending';

    // Update preview log with render request info
    await updateProductVideoPreviewLog(previewId, {
      render_job_id: jobId,
      render_status: status,
      asset_id: cleanText(body.asset_id) || item.asset_id,
      brief: cleanText(body.brief) || item.brief,
      marketing_caption: cleanText(body.marketing_caption) || item.marketing_caption,
      scene_script: cleanText(body.scene_script) || item.scene_script,
      overlay_texts: cleanText(body.overlay_texts) || item.overlay_texts,
      selected_pages: Array.isArray(body.selected_pages) ? JSON.stringify(body.selected_pages) : item.selected_pages,
      public_media_url: metadata?.public_media_url || item.public_media_url,
      media_checksum: metadata?.media_checksum || item.media_checksum,
      media_status: metadata ? 'ready' : item.media_status,
      media_type: metadata?.media_type || item.media_type,
    });

    return NextResponse.json({
      ok: true,
      mock_render: true,
      job_id: jobId,
      status,
      public_media_url: metadata?.public_media_url || null,
      media_type: metadata?.media_type || 'video',
      media_checksum: metadata?.media_checksum || null,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
    });
  } catch (error) {
    console.error('[product-video-render] request failed', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'render_request_failed',
        message: error instanceof Error ? error.message : String(error),
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 500 }
    );
  }
}
