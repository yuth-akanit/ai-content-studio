import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  exchangeYouTubeCodeForTokens,
  storeYouTubeOAuthTokens,
  verifyYouTubeOAuthState,
} from '@/lib/oauth/youtube-oauth';

export const dynamic = 'force-dynamic';

const DEFAULT_APP_BASE_URL = 'https://studio.paaair.online';

function getAppBaseUrl() {
  const configuredUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE_URL;

  try {
    const url = new URL(configuredUrl);
    if (url.hostname === '0.0.0.0') return DEFAULT_APP_BASE_URL;
    return url.origin;
  } catch {
    return DEFAULT_APP_BASE_URL;
  }
}

function safeReturnTo(returnTo: string) {
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/settings';
  return returnTo;
}

function redirectWithStatus(returnTo: string, status: 'connected' | 'error', reason?: string) {
  const url = new URL(safeReturnTo(returnTo), getAppBaseUrl());
  url.searchParams.set('youtube_oauth', status);
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
      return redirectWithStatus('/settings', 'error', 'missing_state');
    }

    const state = verifyYouTubeOAuthState(rawState);

    if (error) {
      return redirectWithStatus(state.return_to, 'error', 'google_denied');
    }

    if (!code) {
      return redirectWithStatus(state.return_to, 'error', 'missing_code');
    }

    const supabase = getSupabaseServerClient();
    const { data: channel, error: channelError } = await supabase
      .from('inbox_channels')
      .select('id,provider')
      .eq('id', state.social_page_id)
      .maybeSingle();

    if (channelError) {
      console.error('[youtube-oauth] channel lookup failed', channelError.message);
      return redirectWithStatus(state.return_to, 'error', 'channel_lookup_failed');
    }

    if (!channel || !['youtube', 'youtube_shorts'].includes(channel.provider)) {
      return redirectWithStatus(state.return_to, 'error', 'invalid_channel');
    }

    const tokenPayload = await exchangeYouTubeCodeForTokens(code);
    await storeYouTubeOAuthTokens(supabase, state.social_page_id, tokenPayload);

    return redirectWithStatus(state.return_to, 'connected');
  } catch (error) {
    console.error('[youtube-oauth] callback failed', error instanceof Error ? error.message : error);
    return redirectWithStatus('/settings', 'error', 'callback_failed');
  }
}
