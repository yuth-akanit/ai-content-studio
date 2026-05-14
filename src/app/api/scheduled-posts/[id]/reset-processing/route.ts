import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  parseZodError,
  uuidSchema,
} from '@/lib/validators/scheduled-posts';

export const dynamic = 'force-dynamic';

// TODO(security): protect this UI-facing endpoint with real app auth before
// exposing the Studio publicly. It uses service role server-side only.

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    uuidSchema.parse(id);
    const supabase = getSupabaseServerClient();

    const { data: existing, error: existingError } = await supabase
      .from('scheduled_posts')
      .select('id,status,retry_count,max_retries')
      .eq('id', id)
      .maybeSingle();

    if (existingError) {
      console.error('[scheduled-posts] load processing item failed', existingError);
      return NextResponse.json(
        { ok: false, error: 'Failed to load scheduled post' },
        { status: 500 },
      );
    }

    if (!existing || existing.status !== 'processing' || existing.retry_count >= existing.max_retries) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled post is not resettable' },
        { status: 409 },
      );
    }

    const { data, error } = await supabase
      .from('scheduled_posts')
      .update({
        status: 'pending',
        locked_at: null,
        locked_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('status', 'processing')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[scheduled-posts] reset processing failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to reset processing scheduled post' },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { ok: false, error: 'Scheduled post is not resettable' },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    console.error('[scheduled-posts] reset processing error', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to reset processing scheduled post' },
      { status: 500 },
    );
  }
}
