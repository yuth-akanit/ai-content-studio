import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireInternalApiKey } from '@/lib/server/internal-api-auth';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  markFailedSchema,
  parseZodError,
  uuidSchema,
} from '@/lib/validators/scheduled-posts';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const authError = requireInternalApiKey(request);
  if (authError) return authError;

  try {
    const { id } = await params;
    uuidSchema.parse(id);

    const body = await request.json();
    const input = markFailedSchema.parse(body);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase.rpc('mark_scheduled_post_failed', {
      p_scheduled_post_id: id,
      p_error_message: input.error_message,
    });

    if (error) {
      console.error('[scheduled-posts] mark failed failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to mark scheduled post as failed' },
        { status: 500 },
      );
    }

    const item = Array.isArray(data) ? data[0] : data;
    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled post not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, item });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    console.error('[scheduled-posts] mark failed error', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to mark scheduled post as failed' },
      { status: 500 },
    );
  }
}
