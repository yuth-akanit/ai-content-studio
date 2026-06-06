import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
} from '@/lib/product-video-preview-log';
import {
  executeProductVideoManualMultiPagePublish,
  getProductVideoManualPublishExecutionAuditPathForDiagnostics,
} from '@/lib/product-video-publish-executor';

export const dynamic = 'force-dynamic';

interface ManualPublishExecuteBody {
  target_page_key?: unknown;
  publish_plan_checksum?: unknown;
  idempotency_key?: unknown;
  selected_page_id?: unknown;
  selected_channel_id?: unknown;
  selected_page_ids?: unknown;
  selected_channel_ids?: unknown;
  manual_execute?: unknown;
  request_scoped_real_publish_approval?: unknown;
  access_token?: unknown;
  page_access_token?: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(cleanText).filter(Boolean) : [];
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

  if (body.access_token || body.page_access_token) {
    return NextResponse.json(
      { ok: false, error: 'request_body_token_rejected', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
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

    const selectedPageIds = cleanTextArray(body.selected_channel_ids).length > 0
      ? cleanTextArray(body.selected_channel_ids)
      : cleanTextArray(body.selected_page_ids).length > 0
        ? cleanTextArray(body.selected_page_ids)
        : [cleanText(body.selected_channel_id) || cleanText(body.selected_page_id)].filter(Boolean);

    const result = await executeProductVideoManualMultiPagePublish({
      item,
      targetPageKey: cleanText(body.target_page_key),
      publishPlanChecksum: cleanText(body.publish_plan_checksum),
      idempotencyKey: cleanText(body.idempotency_key),
      manualExecute: body.manual_execute,
      requestScopedRealPublishApproval: body.request_scoped_real_publish_approval,
      selectedPageIdsOrChannelIds: selectedPageIds,
    });

    const firstExecution = result.executions[0] || null;

    return NextResponse.json({
      ok: true,
      status: result.all_pages_published ? 'published' : 'partial_or_blocked',
      block_reason: result.page_results.find((page) => page.block_reason)?.block_reason || null,
      local_only: true,
      manual_execution: true,
      safe_to_audit: true,
      executions: result.executions,
      page_results: result.page_results,
      selected_page_count: result.selected_page_count,
      publish_allowed: result.all_pages_published,
      real_posting_enabled: firstExecution?.real_posting_enabled || false,
      request_scoped_real_publish_approval: firstExecution?.request_scoped_real_publish_approval || false,
      facebook_post_performed: result.facebook_post_performed,
      facebook_post_id: null,
      facebook_graph_endpoint: null,
      line_broadcast_performed: false,
      schedule_enabled: false,
      renderer_called: false,
      phaya_called: false,
      s3_upload_performed: false,
      mark_posted_performed: result.facebook_post_performed,
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

    const mediaDebug = {
      actual_status: typeof (error as { actual_status?: unknown }).actual_status === 'number'
        ? (error as { actual_status: number }).actual_status
        : undefined,
      actual_content_type: typeof (error as { actual_content_type?: unknown }).actual_content_type === 'string'
        ? (error as { actual_content_type: string }).actual_content_type
        : undefined,
      checked_url: typeof (error as { checked_url?: unknown }).checked_url === 'string'
        ? (error as { checked_url: string }).checked_url
        : null,
    };
    const safeDebug = mediaDebug.actual_status || mediaDebug.actual_content_type || mediaDebug.checked_url
      ? { media_preflight: mediaDebug }
      : {};

    return NextResponse.json(
      { ok: false, error: code, ...safeDebug, ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status },
    );
  }
}
