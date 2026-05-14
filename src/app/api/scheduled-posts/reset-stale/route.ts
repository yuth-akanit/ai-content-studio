import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { parseZodError } from '@/lib/validators/scheduled-posts';

export const dynamic = 'force-dynamic';

// TODO(security): protect this UI-facing endpoint with real app auth before
// exposing the Studio publicly. It uses service role server-side only.

const resetStaleSchema = z.object({
  stale_after_minutes: z.coerce.number().int().min(1).max(1440).default(10),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = resetStaleSchema.parse(body);
    const supabase = getSupabaseServerClient();

    const { data, error } = await supabase.rpc('reset_stale_scheduled_posts', {
      p_stale_after_minutes: input.stale_after_minutes,
    });

    if (error) {
      console.error('[scheduled-posts] manual stale reset failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to reset stale scheduled posts' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, affected_count: data ?? 0 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    console.error('[scheduled-posts] manual stale reset error', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to reset stale scheduled posts' },
      { status: 500 },
    );
  }
}
