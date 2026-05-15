import { NextRequest, NextResponse } from 'next/server';
import { buildTikTokConnectUrl } from '@/lib/oauth/tiktok-oauth';
import { getSupabaseServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

// TODO(security): require real app auth before exposing OAuth connect publicly.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const socialPageId = searchParams.get('social_page_id');

    if (!socialPageId || !UUID_RE.test(socialPageId)) {
      return NextResponse.json(
        { ok: false, error: 'Valid social_page_id is required' },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const { data: channel, error: channelError } = await supabase
      .from('inbox_channels')
      .select('id,provider')
      .eq('id', socialPageId)
      .maybeSingle();

    if (channelError) {
      console.error('[tiktok-oauth] connect channel lookup failed', channelError.message);
      return NextResponse.json(
        { ok: false, error: 'Failed to validate TikTok channel' },
        { status: 500 },
      );
    }

    if (!channel || channel.provider !== 'tiktok') {
      return NextResponse.json(
        { ok: false, error: 'social_page_id must reference a TikTok channel' },
        { status: 400 },
      );
    }

    return NextResponse.redirect(buildTikTokConnectUrl(socialPageId));
  } catch (error) {
    console.error('[tiktok-oauth] connect failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { ok: false, error: 'Failed to start TikTok OAuth' },
      { status: 500 },
    );
  }
}
