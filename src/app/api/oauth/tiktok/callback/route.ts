import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  exchangeTikTokCodeForTokens,
  getPublicAppBaseUrl,
  storeTikTokOAuthTokens,
  verifyTikTokOAuthState,
} from '@/lib/oauth/tiktok-oauth';

export const dynamic = 'force-dynamic';

function redirectWithStatus(status: 'connected' | 'error', reason?: string) {
  const url = new URL('/settings', getPublicAppBaseUrl());
  url.searchParams.set('tiktok_oauth', status);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

// TODO(security): require real app auth before exposing OAuth callback publicly.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const error = searchParams.get('error');
    const code = searchParams.get('code');
    const rawState = searchParams.get('state');

    if (!rawState) {
      return redirectWithStatus('error', 'missing_state');
    }

    const state = verifyTikTokOAuthState(rawState);

    if (error) {
      return redirectWithStatus('error', 'tiktok_denied');
    }

    if (!code) {
      return redirectWithStatus('error', 'missing_code');
    }

    const supabase = getSupabaseServerClient();
    const { data: channel, error: channelError } = await supabase
      .from('inbox_channels')
      .select('id,provider')
      .eq('id', state.social_page_id)
      .maybeSingle();

    if (channelError) {
      console.error('[tiktok-oauth] channel lookup failed', channelError.message);
      return redirectWithStatus('error', 'channel_lookup_failed');
    }

    if (!channel || channel.provider !== 'tiktok') {
      return redirectWithStatus('error', 'invalid_channel');
    }

    const tokenPayload = await exchangeTikTokCodeForTokens(code);
    await storeTikTokOAuthTokens(supabase, state.social_page_id, tokenPayload);

    return redirectWithStatus('connected');
  } catch (error) {
    console.error('[tiktok-oauth] callback failed', error instanceof Error ? error.message : error);
    return redirectWithStatus('error', 'callback_failed');
  }
}
