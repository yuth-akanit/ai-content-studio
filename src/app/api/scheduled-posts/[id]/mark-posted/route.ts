import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireInternalApiKey } from '@/lib/server/internal-api-auth';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  markPostedSchema,
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
    const input = markPostedSchema.parse(body);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase.rpc('mark_scheduled_post_posted', {
      p_scheduled_post_id: id,
      p_post_log_id: input.post_log_id || null,
    });

    if (error) {
      console.error('[scheduled-posts] mark posted failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to mark scheduled post as posted' },
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

    console.error('[scheduled-posts] mark posted error', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to mark scheduled post as posted' },
      { status: 500 },
    );
  }
}
