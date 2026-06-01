import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
} from '@/lib/product-video-preview-log';
import {
  executeProductVideoManualPublish,
  getProductVideoManualPublishExecutionAuditPathForDiagnostics,
} from '@/lib/product-video-publish-executor';

export const dynamic = 'force-dynamic';

interface ManualPublishExecuteBody {
  target_page_key?: unknown;
  publish_plan_checksum?: unknown;
  idempotency_key?: unknown;
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

  let body: ManualPublishExecuteBody;
  try {
    body = await request.json() as ManualPublishExecuteBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status: 400 },
    );
  }

  try {
    const item = await findProductVideoPreviewLogById(previewId);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'preview_log_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 },
      );
    }

    const result = await executeProductVideoManualPublish({
      item,
      targetPageKey: cleanText(body.target_page_key),
      publishPlanChecksum: cleanText(body.publish_plan_checksum),
      idempotencyKey: cleanText(body.idempotency_key),
    });

    return NextResponse.json({
      ok: true,
      status: result.execution.status,
      block_reason: result.execution.block_reason,
      local_only: true,
      manual_execution: true,
      safe_to_audit: true,
      idempotent_replay: result.idempotent_replay,
      execution_plan: result.execution_plan,
      execution: result.execution,
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
        publish_execution_audit_path: getProductVideoManualPublishExecutionAuditPathForDiagnostics(),
      },
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'manual_publish_execute_failed';

    if (status >= 500) {
      console.error('[product-video] manual publish execute failed', error);
    }

    return NextResponse.json(
      { ok: false, error: code, ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status },
    );
  }
}
