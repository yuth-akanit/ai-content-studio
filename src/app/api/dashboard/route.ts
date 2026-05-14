import { NextResponse } from 'next/server';
import { getDefaultProfileByFields } from '@/lib/repositories/profiles';
import { getContentStats, getContents } from '@/lib/repositories/content';
import { getCampaigns } from '@/lib/repositories/campaigns';
import { getSupabaseServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

const SCHEDULED_STATUSES = ['pending', 'processing', 'posted', 'failed', 'cancelled'] as const;

type ScheduledStatus = typeof SCHEDULED_STATUSES[number];
type JsonRecord = Record<string, unknown>;

interface DashboardContentRelation {
  id: string;
  business_profile_id?: string;
  platform?: string;
  content_type?: string;
  topic?: string | null;
  output_payload?: unknown;
}

interface DashboardChannelRelation {
  id: string;
  name?: string | null;
  provider?: string | null;
  external_id?: string | null;
  meta?: unknown;
}

interface PostLogRow {
  id: string;
  content_id: string | null;
  social_page_id: string | null;
  provider: string | null;
  post_external_id: string | null;
  status: string | null;
  error_message: string | null;
  posted_at: string | null;
  created_at: string | null;
  generated_contents?: DashboardContentRelation | DashboardContentRelation[] | null;
  inbox_channels?: DashboardChannelRelation | DashboardChannelRelation[] | null;
}

interface ScheduledPostRow {
  id: string;
  content_id: string;
  social_page_id: string;
  scheduled_at: string;
  status: string;
  retry_count: number;
  max_retries: number;
  locked_by: string | null;
  posted_at: string | null;
  post_log_id: string | null;
  error_message: string | null;
  created_at: string | null;
  generated_contents?: DashboardContentRelation | DashboardContentRelation[] | null;
  inbox_channels?: DashboardChannelRelation | DashboardChannelRelation[] | null;
}

function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function cleanText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function buildContentTitle(content: DashboardContentRelation | null): string {
  const payload = asRecord(content?.output_payload);
  return (
    cleanText(payload.title) ||
    cleanText(payload.headline) ||
    cleanText(payload.hook) ||
    cleanText(content?.topic) ||
    'Untitled content'
  );
}

function buildContentPreview(content: DashboardContentRelation | null): string | null {
  const payload = asRecord(content?.output_payload);
  const script = cleanText(payload.script);
  const caption =
    cleanText(payload.caption) ||
    cleanText(payload.caption_tiktok) ||
    cleanText(payload.caption_youtube_shorts) ||
    cleanText(payload.message) ||
    cleanText(payload.body);
  const preview = caption || script || cleanText(content?.topic);
  if (!preview) return null;
  return preview.length > 140 ? `${preview.slice(0, 137)}...` : preview;
}

function getChannelName(channel: DashboardChannelRelation | null): string | null {
  return cleanText(channel?.name) || cleanText(channel?.external_id);
}

async function listRecentPostLogs(profileId: string) {
  const db = getSupabaseServerClient();

  try {
    const { data, error } = await db
      .from('post_logs')
      .select(`
        id,
        content_id,
        social_page_id,
        provider,
        post_external_id,
        status,
        error_message,
        posted_at,
        created_at,
        generated_contents!inner(id,business_profile_id,platform,content_type,topic,output_payload),
        inbox_channels(id,name,provider,external_id,meta)
      `)
      .eq('generated_contents.business_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[dashboard] post_logs unavailable', { code: error.code, message: error.message });
      return [];
    }

    return ((data || []) as unknown as PostLogRow[]).map((row) => {
      const content = unwrapRelation(row.generated_contents);
      const channel = unwrapRelation(row.inbox_channels);

      return {
        id: row.id,
        content_id: row.content_id,
        platform: row.provider || channel?.provider || content?.platform || null,
        provider: row.provider,
        social_page_id: row.social_page_id,
        channel_id: row.social_page_id,
        status: row.status,
        posted_url: null,
        external_url: null,
        post_external_id: row.post_external_id,
        error_message: row.error_message,
        created_at: row.created_at,
        posted_at: row.posted_at,
        content_title: buildContentTitle(content),
        content_preview: buildContentPreview(content),
        page_name: getChannelName(channel),
      };
    });
  } catch (error) {
    console.warn('[dashboard] failed to load post_logs', error);
    return [];
  }
}

async function getScheduledPostSummary(profileId: string): Promise<Record<ScheduledStatus, number>> {
  const db = getSupabaseServerClient();
  const emptySummary = SCHEDULED_STATUSES.reduce(
    (summary, status) => ({ ...summary, [status]: 0 }),
    {} as Record<ScheduledStatus, number>,
  );

  try {
    const counts = await Promise.all(
      SCHEDULED_STATUSES.map(async (status) => {
        const { count, error } = await db
          .from('scheduled_posts')
          .select('id,generated_contents!inner(business_profile_id)', { count: 'exact', head: true })
          .eq('status', status)
          .eq('generated_contents.business_profile_id', profileId);

        if (error) throw error;
        return [status, count || 0] as const;
      }),
    );

    return counts.reduce(
      (summary, [status, count]) => ({ ...summary, [status]: count }),
      emptySummary,
    );
  } catch (error) {
    console.warn('[dashboard] scheduled_posts summary unavailable', error);
    return emptySummary;
  }
}

async function listRecentScheduledPosts(profileId: string) {
  const db = getSupabaseServerClient();

  try {
    const { data, error } = await db
      .from('scheduled_posts')
      .select(`
        id,
        content_id,
        social_page_id,
        scheduled_at,
        status,
        retry_count,
        max_retries,
        locked_by,
        posted_at,
        post_log_id,
        error_message,
        created_at,
        generated_contents!inner(id,business_profile_id,platform,content_type,topic,output_payload),
        inbox_channels(id,name,provider,external_id,meta)
      `)
      .eq('generated_contents.business_profile_id', profileId)
      .order('scheduled_at', { ascending: false })
      .limit(10);

    if (error) {
      console.warn('[dashboard] scheduled_posts unavailable', { code: error.code, message: error.message });
      return [];
    }

    return ((data || []) as unknown as ScheduledPostRow[]).map((row) => {
      const content = unwrapRelation(row.generated_contents);
      const channel = unwrapRelation(row.inbox_channels);

      return {
        id: row.id,
        content_id: row.content_id,
        social_page_id: row.social_page_id,
        scheduled_at: row.scheduled_at,
        status: row.status,
        retry_count: row.retry_count,
        max_retries: row.max_retries,
        locked_by: row.locked_by,
        posted_at: row.posted_at,
        post_log_id: row.post_log_id,
        error_message: row.error_message,
        created_at: row.created_at,
        content_title: buildContentTitle(content),
        content_preview: buildContentPreview(content),
        page_name: getChannelName(channel),
        platform: channel?.provider || content?.platform || null,
      };
    });
  } catch (error) {
    console.warn('[dashboard] failed to load scheduled_posts', error);
    return [];
  }
}

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
        recent_post_logs: [],
        scheduled_post_summary: {
          pending: 0,
          processing: 0,
          posted: 0,
          failed: 0,
          cancelled: 0,
        },
        recent_scheduled_posts: [],
        hasProfile: false,
        profileId: null,
      });
    }

    const statsStartedAt = performance.now();
    const recentStartedAt = performance.now();
    const campaignsStartedAt = performance.now();
    const postLogsStartedAt = performance.now();
    const scheduledSummaryStartedAt = performance.now();
    const scheduledStartedAt = performance.now();

    const [stats, recentContent, campaigns, recentPostLogs, scheduledPostSummary, recentScheduledPosts] = await Promise.all([
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
      listRecentPostLogs(profile.id).then((result) => ({
        result,
        durationMs: Math.round(performance.now() - postLogsStartedAt),
      })),
      getScheduledPostSummary(profile.id).then((result) => ({
        result,
        durationMs: Math.round(performance.now() - scheduledSummaryStartedAt),
      })),
      listRecentScheduledPosts(profile.id).then((result) => ({
        result,
        durationMs: Math.round(performance.now() - scheduledStartedAt),
      })),
    ]);

    console.info('[dashboard] timings', {
      profileMs: profileDurationMs,
      statsMs: stats.durationMs,
      recentMs: recentContent.durationMs,
      campaignsMs: campaigns.durationMs,
      postLogsMs: recentPostLogs.durationMs,
      scheduledSummaryMs: scheduledPostSummary.durationMs,
      scheduledPostsMs: recentScheduledPosts.durationMs,
      totalMs: Math.round(performance.now() - startedAt),
    });

    return NextResponse.json({
      stats: stats.result,
      recentContents: recentContent.result.data,
      campaigns: campaigns.result,
      recent_post_logs: recentPostLogs.result,
      scheduled_post_summary: scheduledPostSummary.result,
      recent_scheduled_posts: recentScheduledPosts.result,
      hasProfile: true,
      profileId: profile.id,
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
