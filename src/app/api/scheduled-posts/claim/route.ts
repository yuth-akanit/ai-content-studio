import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import { requireInternalApiKey } from '@/lib/server/internal-api-auth';
import {
  claimScheduledPostsSchema,
  parseZodError,
} from '@/lib/validators/scheduled-posts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authError = requireInternalApiKey(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const input = claimScheduledPostsSchema.parse(body);
    const supabase = getSupabaseServerClient();

    const { error: resetError } = await supabase.rpc('reset_stale_scheduled_posts', {
      p_stale_after_minutes: 10,
    });

    if (resetError) {
      console.error('[scheduled-posts] stale reset failed', resetError);
      return NextResponse.json(
        { ok: false, error: 'Failed to reset stale scheduled posts' },
        { status: 500 },
      );
    }

    const { data, error } = await supabase.rpc('claim_due_scheduled_posts', {
      p_limit: input.limit,
      p_worker_id: input.worker_id,
    });

    if (error) {
      console.error('[scheduled-posts] claim failed', error);
      return NextResponse.json(
        { ok: false, error: 'Failed to claim scheduled posts' },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    console.error('[scheduled-posts] claim error', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to claim scheduled posts' },
      { status: 500 },
    );
  }
}
