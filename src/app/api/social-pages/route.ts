import { getSupabaseServerClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeMeta(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const raw = meta as Record<string, unknown>;
  const { access_token: _accessToken, refresh_token: _refreshToken, token: _token, ...safeMeta } = raw;
  return {
    ...safeMeta,
    access_token_present: typeof raw.access_token === 'string' && raw.access_token.trim().length > 0,
  };
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseServerClient();
  const provider = cleanText(request.nextUrl.searchParams.get('provider')).toLowerCase();
  const status = cleanText(request.nextUrl.searchParams.get('status')).toLowerCase();

  let query = supabase
    .from('inbox_channels')
    .select('id,name,provider,external_id,status,meta')
    .order('name');

  if (provider) query = query.eq('provider', provider);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data || []).map((row) => ({
    ...row,
    meta: sanitizeMeta(row.meta),
  })));
}
