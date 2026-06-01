import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  applyProductVideoPreviewDecision,
  getProductVideoApprovalDecisionLogPathForDiagnostics,
  parseProductVideoApprovalDecision,
} from '@/lib/product-video-preview-log';

export const dynamic = 'force-dynamic';

interface DecisionRequestBody {
  decision?: unknown;
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
      {
        ok: false,
        error: 'preview_id_required',
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 400 },
    );
  }

  let body: DecisionRequestBody;
  try {
    body = await request.json() as DecisionRequestBody;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_json',
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 400 },
    );
  }

  const decision = parseProductVideoApprovalDecision(body.decision);
  if (!decision) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_decision',
        allowed_decisions: ['approve', 'reject', 'request_changes'],
        ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      },
      { status: 400 },
    );
  }

  try {
    const result = await applyProductVideoPreviewDecision({
      previewId,
      decision,
      reason: cleanText(body.reason),
    });

    return NextResponse.json({
      ok: true,
      local_only: true,
      publish_allowed: false,
      facebook_post_performed: false,
      line_broadcast_performed: false,
      schedule_enabled: false,
      renderer_called: false,
      phaya_called: false,
      s3_upload_performed: false,
      mark_posted_performed: false,
      item: result.item,
      decision_record: result.decision_record,
      storage: {
        decision_audit_log_path: getProductVideoApprovalDecisionLogPathForDiagnostics(),
      },
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'decision_apply_failed';

    if (status >= 500) {
      console.error('[product-video] preview decision failed', error);
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
