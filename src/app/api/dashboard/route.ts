import { NextResponse } from 'next/server';
import { getDefaultProfile } from '@/lib/repositories/profiles';
import { getContentStats, getContents } from '@/lib/repositories/content';
import { getCampaigns } from '@/lib/repositories/campaigns';

export async function GET() {
  try {
    // 1. Get default profile
    const profile = await getDefaultProfile();

    if (!profile) {
      return NextResponse.json({
        stats: { total: 0, byPlatform: {}, byType: {}, recentCount: 0 },
        recentContents: [],
        campaigns: [],
        hasProfile: false,
        profileId: null,
      });
    }

    // 2. Fetch everything in parallel on the server
    const [stats, recentContent, campaigns] = await Promise.all([
      getContentStats(profile.id),
      getContents(profile.id, { limit: 5 }),
      getCampaigns(profile.id),
    ]);

    return NextResponse.json({
      stats,
      recentContents: recentContent.data,
      campaigns: campaigns,
      hasProfile: true,
      profileId: profile.id,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
