import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
} from '@/lib/product-video-preview-log';
import { buildProductVideoPublishPlanPreview } from '@/lib/product-video-publish-plan';

export const dynamic = 'force-dynamic';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ previewId?: string }> },
) {
  const { previewId: rawPreviewId } = await params;
  const previewId = cleanText(rawPreviewId);

  if (!previewId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'preview_id_required',
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 400 },
    );
  }

  try {
    const item = await findProductVideoPreviewLogById(previewId);
    if (!item) {
      return NextResponse.json(
        {
          ok: false,
          error: 'preview_log_not_found',
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 404 },
      );
    }

    const publishPlan = buildProductVideoPublishPlanPreview(item);
    return NextResponse.json({
      ok: true,
      local_only: true,
      read_only: true,
      item,
      publish_plan: publishPlan,
      publish_allowed: false,
      facebook_post_performed: false,
      line_broadcast_performed: false,
      schedule_enabled: false,
      renderer_called: false,
      phaya_called: false,
      s3_upload_performed: false,
      mark_posted_performed: false,
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'publish_plan_preview_failed';

    if (status >= 500) {
      console.error('[product-video] publish plan preview failed', error);
    }

    return NextResponse.json(
      {
        ok: false,
        error: code,
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status },
    );
  }
}
