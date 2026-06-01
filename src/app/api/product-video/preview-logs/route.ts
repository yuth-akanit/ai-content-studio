import { NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  getProductVideoApprovalDecisionLogPathForDiagnostics,
  getProductVideoPreviewLogPathForDiagnostics,
  listProductVideoPreviewLogs,
} from '@/lib/product-video-preview-log';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await listProductVideoPreviewLogs();
    return NextResponse.json({
      ok: true,
      count: items.length,
      items,
      local_approval_only: true,
      ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
      storage: {
        type: 'jsonl',
        path: getProductVideoPreviewLogPathForDiagnostics(),
        decision_audit_log_path: getProductVideoApprovalDecisionLogPathForDiagnostics(),
      },
    });
  } catch (error) {
    console.error('[product-video] preview log list failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to load product video preview logs' },
      { status: 500 },
    );
  }
}
