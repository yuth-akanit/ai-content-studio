import { NextRequest, NextResponse } from 'next/server';

export function requireInternalApiKey(request: NextRequest): NextResponse | null {
  const expected = process.env.INTERNAL_API_SECRET;

  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'Internal API secret is not configured' },
      { status: 500 },
    );
  }

  if (request.headers.get('x-api-key') !== expected) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  return null;
}
