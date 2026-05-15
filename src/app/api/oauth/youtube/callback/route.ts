import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  exchangeYouTubeCodeForTokens,
  storeYouTubeOAuthTokens,
  verifyYouTubeOAuthState,
} from '@/lib/oauth/youtube-oauth';

export const dynamic = 'force-dynamic';

function redirectWithStatus(requestUrl: string, returnTo: string, status: 'connected' | 'error', reason?: string) {
  const url = new URL(returnTo, requestUrl);
  url.searchParams.set('youtube_oauth', status);
  if (reason) url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

// TODO(security): require real app auth before exposing OAuth callback publicly.
export async function GET(request: NextRequest) {
  const requestUrl = request.url;

  try {
    const { searchParams } = new URL(requestUrl);
    const error = searchParams.get('error');
    const code = searchParams.get('code');
    const rawState = searchParams.get('state');

    if (!rawState) {
      return redirectWithStatus(requestUrl, '/settings', 'error', 'missing_state');
    }

    const state = verifyYouTubeOAuthState(rawState);

    if (error) {
      return redirectWithStatus(requestUrl, state.return_to, 'error', 'google_denied');
    }

    if (!code) {
      return redirectWithStatus(requestUrl, state.return_to, 'error', 'missing_code');
    }

    const supabase = getSupabaseServerClient();
    const { data: channel, error: channelError } = await supabase
      .from('inbox_channels')
      .select('id,provider')
      .eq('id', state.social_page_id)
      .maybeSingle();

    if (channelError) {
      console.error('[youtube-oauth] channel lookup failed', channelError.message);
      return redirectWithStatus(requestUrl, state.return_to, 'error', 'channel_lookup_failed');
    }

    if (!channel || !['youtube', 'youtube_shorts'].includes(channel.provider)) {
      return redirectWithStatus(requestUrl, state.return_to, 'error', 'invalid_channel');
    }

    const tokenPayload = await exchangeYouTubeCodeForTokens(code);
    await storeYouTubeOAuthTokens(supabase, state.social_page_id, tokenPayload);

    return redirectWithStatus(requestUrl, state.return_to, 'connected');
  } catch (error) {
    console.error('[youtube-oauth] callback failed', error instanceof Error ? error.message : error);
    return redirectWithStatus(requestUrl, '/settings', 'error', 'callback_failed');
  }
}
