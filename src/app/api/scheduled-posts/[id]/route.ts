import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { updateScheduledPost } from '@/lib/repositories/scheduled-posts';
import {
  parseZodError,
  updateScheduledPostSchema,
  uuidSchema,
} from '@/lib/validators/scheduled-posts';

export const dynamic = 'force-dynamic';

// TODO(security): protect this UI-facing endpoint with real app auth before
// exposing the Studio publicly.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    uuidSchema.parse(id);

    const body = await request.json();
    const input = updateScheduledPostSchema.parse(body);
    const item = await updateScheduledPost(id, input);
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    if (error instanceof Error && error.message === 'Scheduled post not found') {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 404 },
      );
    }

    if (error instanceof Error && (
      error.message === 'Only pending scheduled posts can be rescheduled' ||
      error.message === 'Only pending or failed scheduled posts can be cancelled'
    )) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 409 },
      );
    }

    console.error('[scheduled-posts] update failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to update scheduled post' },
      { status: 500 },
    );
  }
}
