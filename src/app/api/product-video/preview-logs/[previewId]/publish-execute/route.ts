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
  manual_execute?: unknown;
  request_scoped_real_publish_approval?: unknown;
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
      manualExecute: body.manual_execute,
      requestScopedRealPublishApproval: body.request_scoped_real_publish_approval,
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
      publish_allowed: result.execution.publish_allowed,
      real_posting_enabled: result.execution.real_posting_enabled,
      request_scoped_real_publish_approval: result.execution.request_scoped_real_publish_approval,
      facebook_post_performed: result.execution.facebook_post_performed,
      facebook_post_id: result.execution.facebook_post_id,
      facebook_graph_endpoint: result.execution.facebook_graph_endpoint,
      line_broadcast_performed: result.execution.line_broadcast_performed,
      schedule_enabled: result.execution.schedule_enabled,
      renderer_called: result.execution.renderer_called,
      phaya_called: result.execution.phaya_called,
      s3_upload_performed: result.execution.s3_upload_performed,
      mark_posted_performed: result.execution.mark_posted_performed,
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
