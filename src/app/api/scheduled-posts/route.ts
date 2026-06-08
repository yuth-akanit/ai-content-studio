import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  createScheduledPosts,
  listScheduledPosts,
} from '@/lib/repositories/scheduled-posts';
import {
  createScheduledPostsSchema,
  listScheduledPostsQuerySchema,
  parseZodError,
} from '@/lib/validators/scheduled-posts';

export const dynamic = 'force-dynamic';

function classifyCreateError(error: Error) {
  const message = error.message.toLowerCase();

  if (
    message.includes('statement timeout') ||
    message.includes('canceling statement') ||
    message.includes('520') ||
    message.includes('cloudflare') ||
    message.includes('web server is returning an unknown error')
  ) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'scheduled_posts_create_retryable',
        message: 'Scheduled post creation timed out. Please retry.',
        retryable: true,
      },
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: 'scheduled_posts_create_failed',
      message: 'Failed to create scheduled posts',
      retryable: false,
    },
  };
}

// TODO(security): protect these UI-facing endpoints with real app auth before
// exposing the Studio publicly. They currently use server-side service role
// access because the app has no user auth layer yet.

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = listScheduledPostsQuerySchema.parse(params);
    const items = await listScheduledPosts(filters);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    console.error('[scheduled-posts] list failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to list scheduled posts' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createScheduledPostsSchema.parse(body);
    const items = await createScheduledPosts(input);
    return NextResponse.json({ ok: true, items }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseZodError(error) },
        { status: 400 },
      );
    }

    if (error instanceof Error && (
      error.message === 'Content not found' ||
      error.message === 'One or more social pages were not found'
    )) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 404 },
      );
    }

    console.error('[scheduled-posts] create failed', error);

    if (error instanceof Error) {
      const classified = classifyCreateError(error);
      return NextResponse.json(classified.body, { status: classified.status });
    }

    return NextResponse.json(
      {
        ok: false,
        error: 'scheduled_posts_create_failed',
        message: 'Failed to create scheduled posts',
        retryable: false,
      },
      { status: 500 },
    );
  }
}
