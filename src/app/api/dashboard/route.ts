import { NextResponse } from 'next/server';
import { getDefaultProfileByFields } from '@/lib/repositories/profiles';
import { getContentStats, getContents } from '@/lib/repositories/content';
import { getCampaigns } from '@/lib/repositories/campaigns';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = performance.now();
  try {
    const profileStartedAt = performance.now();
    const profile = await getDefaultProfileByFields('id');
    const profileDurationMs = Math.round(performance.now() - profileStartedAt);

    if (!profile) {
      console.info('[dashboard] no profile', {
        profileMs: profileDurationMs,
        totalMs: Math.round(performance.now() - startedAt),
      });
      return NextResponse.json({
        stats: { total: 0, byPlatform: {}, byType: {}, recentCount: 0 },
        recentContents: [],
        campaigns: [],
        hasProfile: false,
        profileId: null,
      });
    }

    const statsStartedAt = performance.now();
    const recentStartedAt = performance.now();
    const campaignsStartedAt = performance.now();

    const [stats, recentContent, campaigns] = await Promise.all([
      getContentStats(profile.id).then((result) => ({
        result,
        durationMs: Math.round(performance.now() - statsStartedAt),
      })),
      getContents(
        profile.id,
        { limit: 5 },
        'id, platform, content_type, topic, created_at, output_payload',
      ).then((result) => ({
        result,
        durationMs: Math.round(performance.now() - recentStartedAt),
      })),
      getCampaigns(
        profile.id,
        'id, name, campaign_type, status, updated_at, created_at',
      ).then((result) => ({
        result,
        durationMs: Math.round(performance.now() - campaignsStartedAt),
      })),
    ]);

    console.info('[dashboard] timings', {
      profileMs: profileDurationMs,
      statsMs: stats.durationMs,
      recentMs: recentContent.durationMs,
      campaignsMs: campaigns.durationMs,
      totalMs: Math.round(performance.now() - startedAt),
    });

    return NextResponse.json({
      stats: stats.result,
      recentContents: recentContent.result.data,
      campaigns: campaigns.result,
      hasProfile: true,
      profileId: profile.id,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
