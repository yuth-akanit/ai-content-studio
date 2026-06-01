import { NextResponse } from 'next/server';
import {
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
      storage: {
        type: 'jsonl',
        path: getProductVideoPreviewLogPathForDiagnostics(),
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
