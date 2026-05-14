import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import {
  createShortFormCampaign,
  listShortFormCampaigns,
} from '@/lib/repositories/short-form-campaigns';
import {
  createShortFormCampaignSchema,
  listShortFormCampaignsQuerySchema,
  parseShortFormError,
} from '@/lib/validators/short-form-campaigns';

export const dynamic = 'force-dynamic';

// TODO(security): protect this UI-facing endpoint with real app auth before
// public exposure. Server routes use service role; no service role key is sent
// to the browser.

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = listShortFormCampaignsQuerySchema.parse(params);
    const items = await listShortFormCampaigns(filters);
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseShortFormError(error) },
        { status: 400 },
      );
    }

    console.error('[short-form-campaigns] list failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to list short-form campaigns' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = createShortFormCampaignSchema.parse(body);
    const item = await createShortFormCampaign(input);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: parseShortFormError(error) },
        { status: 400 },
      );
    }

    console.error('[short-form-campaigns] create failed', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to create short-form campaign' },
      { status: 500 },
    );
  }
}
