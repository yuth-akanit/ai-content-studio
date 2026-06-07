import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
} from '@/lib/product-video-preview-log';
import {
  authorizeProductVideoPublishPlan,
  getProductVideoPublishAuthorizationLogPathForDiagnostics,
} from '@/lib/product-video-publish-authorization';

export const dynamic = 'force-dynamic';

interface PublishAuthorizationBody {
  target_page_key?: unknown;
  publish_plan_checksum?: unknown;
  idempotency_key?: unknown;
  reason?: unknown;
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

  let body: PublishAuthorizationBody;
  try {
    body = await request.json() as PublishAuthorizationBody;
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

    const result = await authorizeProductVideoPublishPlan({
      item,
      targetPageKey: cleanText(body.target_page_key),
      publishPlanChecksum: cleanText(body.publish_plan_checksum),
      idempotencyKey: cleanText(body.idempotency_key),
      reason: cleanText(body.reason),
    });

    return NextResponse.json({
      ok: true,
      status: result.authorization.status,
      local_only: true,
      audit_only: true,
      idempotent_replay: result.idempotent_replay,
      authorization: result.authorization,
      publish_plan: result.publish_plan,
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
        publish_authorization_log_path: getProductVideoPublishAuthorizationLogPathForDiagnostics(),
      },
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'publish_authorization_failed';

    const message = typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : code;
    const blockReason = typeof (error as { block_reason?: unknown }).block_reason === 'string'
      ? (error as { block_reason: string }).block_reason
      : null;

    if (status >= 500) {
      console.error('[product-video] publish authorization failed', error);
    }

    return NextResponse.json(
      { ok: false, error: code, message, block_reason: blockReason, ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status },
    );
  }
}
