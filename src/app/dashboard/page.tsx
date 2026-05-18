'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/context/profile-context';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Sparkles,
  FileText,
  TrendingUp,
  FolderKanban,
  Plus,
  ArrowRight,
  LayoutDashboard,
  ExternalLink,
  History,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Platform,
  PLATFORM_LABELS,
  GeneratedContent,
  ContentProject,
  CONTENT_TYPE_LABELS,
  ContentType,
} from '@/types/database';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

interface DashboardData {
  stats: {
    total: number;
    byPlatform: Record<string, number>;
    byType: Record<string, number>;
    recentCount: number;
  };
  recentContents: GeneratedContent[];
  campaigns: ContentProject[];
  recent_post_logs: RecentPostLog[];
  scheduled_post_summary: ScheduledPostSummary;
  recent_scheduled_posts: RecentScheduledPost[];
  hasProfile: boolean;
  profileId: string | null;
}

interface RecentPostLog {
  id: string;
  content_id: string | null;
  platform: string | null;
  provider: string | null;
  social_page_id: string | null;
  channel_id: string | null;
  status: string | null;
  posted_url: string | null;
  external_url: string | null;
  post_external_id: string | null;
  error_message: string | null;
  created_at: string | null;
  posted_at: string | null;
  content_title: string;
  content_preview: string | null;
  page_name: string | null;
}

interface ScheduledPostSummary {
  pending: number;
  processing: number;
  posted: number;
  failed: number;
  cancelled: number;
}

interface RecentScheduledPost {
  id: string;
  content_id: string;
  social_page_id: string;
  scheduled_at: string;
  status: keyof ScheduledPostSummary | string;
  retry_count: number;
  max_retries: number;
  locked_by: string | null;
  posted_at: string | null;
  post_log_id: string | null;
  error_message: string | null;
  created_at: string | null;
  content_title: string;
  content_preview: string | null;
  page_name: string | null;
  platform: string | null;
}

const EMPTY_SCHEDULED_SUMMARY: ScheduledPostSummary = {
  pending: 0,
  processing: 0,
  posted: 0,
  failed: 0,
  cancelled: 0,
};

const SCHEDULED_STATUS_LABELS: Record<keyof ScheduledPostSummary, string> = {
  pending: 'รอโพสต์',
  processing: 'กำลังโพสต์',
  posted: 'โพสต์แล้ว',
  failed: 'ล้มเหลว',
  cancelled: 'ยกเลิก',
};

const POST_LOG_STATUS_LABELS: Record<string, string> = {
  success: 'สำเร็จ',
  posted: 'สำเร็จ',
  failed: 'ล้มเหลว',
  error: 'ล้มเหลว',
  pending: 'รอ',
};

function normalizePlatform(platform: string | null | undefined): Platform {
  if (platform === 'line') return 'line_oa';
  if (platform && platform in PLATFORM_LABELS) return platform as Platform;
  return 'other';
}

function displayProvider(provider: string | null | undefined) {
  if (provider === 'youtube' || provider === 'youtube_shorts') {
    return {
      label: 'YouTube',
      className: 'bg-red-100 text-red-700 border-red-200',
    };
  }

  const platform = normalizePlatform(provider);
  return {
    label: PLATFORM_LABELS[platform],
    className: '',
    platform,
  };
}

function ProviderBadge({ provider }: { provider: string | null | undefined }) {
  const display = displayProvider(provider);

  if (display.platform) {
    return <PlatformBadge platform={display.platform} />;
  }

  return (
    <Badge variant="outline" className={display.className}>
      {display.label}
    </Badge>
  );
}

function getPostLogUrl(log: RecentPostLog) {
  if ((log.provider === 'youtube' || log.platform === 'youtube') && log.post_external_id) {
    return `https://youtube.com/shorts/${encodeURIComponent(log.post_external_id)}`;
  }

  return log.posted_url || log.external_url;
}

function getPostLogLinkLabel(log: RecentPostLog) {
  if ((log.provider === 'youtube' || log.platform === 'youtube') && log.post_external_id) {
    return 'เปิด Shorts';
  }

  return 'เปิดโพสต์';
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function postLogStatusLabel(status: string | null | undefined) {
  if (!status) return 'รอ';
  return POST_LOG_STATUS_LABELS[status] || status;
}

function scheduledStatusLabel(status: string | null | undefined) {
  if (!status) return '-';
  if (status in SCHEDULED_STATUS_LABELS) {
    return SCHEDULED_STATUS_LABELS[status as keyof ScheduledPostSummary];
  }
  return status;
}

function statusBadgeClass(status: string | null | undefined) {
  switch (status) {
    case 'success':
    case 'posted':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'processing':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'failed':
    case 'error':
      return 'bg-red-50 text-red-700 border-red-200';
    case 'cancelled':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'pending':
    default:
      return 'bg-amber-50 text-amber-700 border-amber-200';
  }
}

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const res = await fetch('/api/dashboard');
      const dashboardData = await res.json();
      
      if (dashboardData.error) {
        throw new Error(dashboardData.error);
      }

      setData(dashboardData);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setData({
        stats: { total: 0, byPlatform: {}, byType: {}, recentCount: 0 },
        recentContents: [],
        campaigns: [],
        recent_post_logs: [],
        scheduled_post_summary: EMPTY_SCHEDULED_SUMMARY,
        recent_scheduled_posts: [],
        hasProfile: false,
        profileId: null,
      });
    } finally {
      setLoading(false);
    }
  }

  async function runScheduledAction(actionKey: string, request: () => Promise<Response>) {
    setActionLoading(actionKey);
    setActionError(null);

    try {
      const res = await request();
      const result = await res.json().catch(() => ({}));

      if (!res.ok || result?.ok === false) {
        throw new Error(result?.error || 'Scheduled queue action failed');
      }

      await loadDashboard();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Scheduled queue action failed');
    } finally {
      setActionLoading(null);
    }
  }

  function resetStaleScheduledPosts() {
    return runScheduledAction('reset-stale', () => fetch('/api/scheduled-posts/reset-stale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stale_after_minutes: 10 }),
    }));
  }

  function resetProcessingPost(id: string) {
    return runScheduledAction(`reset-${id}`, () => fetch(`/api/scheduled-posts/${id}/reset-processing`, {
      method: 'POST',
    }));
  }

  function markProcessingPostFailed(id: string) {
    return runScheduledAction(`fail-${id}`, () => fetch(`/api/scheduled-posts/${id}/manual-fail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error_message: 'Manually marked failed from dashboard' }),
    }));
  }

  function cancelScheduledPost(id: string) {
    return runScheduledAction(`cancel-${id}`, () => fetch(`/api/scheduled-posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    }));
  }

  if (profileLoading && !data) return <LoadingSpinner text={THAI_UI_LABELS.loading_dashboard} />;
  
  if (!profileLoading && !profile) {
    return (
      <div>
        <PageHeader title={THAI_UI_LABELS.dashboard} description="AI Content Studio for Service Business" />
        <EmptyState
          icon={LayoutDashboard}
          title={THAI_UI_LABELS.welcome_title}
          description={THAI_UI_LABELS.welcome_desc}
          actionLabel={THAI_UI_LABELS.create_profile_btn}
          onAction={() => (window.location.href = '/profile')}
        />
      </div>
    );
  }

  if (loading && !data) return <LoadingSpinner text={THAI_UI_LABELS.loading_dashboard} />;
  if (!data) return null;

  const platformEntries = Object.entries(data.stats.byPlatform).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <PageHeader
        title={THAI_UI_LABELS.dashboard}
        description={THAI_UI_LABELS.dashboard_overview}
        actions={
          <Link href="/generate">
            <Button className="bg-blue-600 hover:bg-blue-700 h-10 px-6 rounded-full shadow-lg shadow-blue-200">
              <Sparkles className="h-4 w-4 mr-2" />
              {THAI_UI_LABELS.generate_content_btn}
            </Button>
          </Link>
        }
      />

      <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">TikTok is pending Developer Review</p>
        <p className="mt-1">
          Login Kit and Content Posting API are submitted for review. OAuth may fail
          until TikTok approves the app/client_key.
          Current scopes: user.info.basic, video.upload. Public direct posting is disabled.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Card className="border-none shadow-sm bg-blue-50/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-1 sm:mt-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{data.stats.total}</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">{THAI_UI_LABELS.total_contents}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-green-50/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div className="mt-1 sm:mt-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{data.stats.recentCount}</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">{THAI_UI_LABELS.last_7_days}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-purple-50/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <FolderKanban className="h-5 w-5 text-purple-600" />
              </div>
              <div className="mt-1 sm:mt-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{data.campaigns.length}</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">{THAI_UI_LABELS.campaign_workspace}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-orange-50/50">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-orange-600" />
              </div>
              <div className="mt-1 sm:mt-0">
                <p className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{Object.keys(data.stats.byPlatform).length}</p>
                <p className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">{THAI_UI_LABELS.platforms_used}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Content */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.recent_content}</CardTitle>
            <Link href="/library" className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-medium">
              {THAI_UI_LABELS.view_all} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.recentContents.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {THAI_UI_LABELS.no_content_yet}
              </p>
            ) : (
              <div className="space-y-3">
                {data.recentContents.map((content) => (
                  <div key={content.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3 min-w-0">
                      <PlatformBadge platform={content.platform} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {content.output_payload?.title || content.topic || CONTENT_TYPE_LABELS[content.content_type as ContentType] || content.content_type}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(content.created_at).toLocaleDateString('th-TH')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.by_platform}</CardTitle>
          </CardHeader>
          <CardContent>
            {platformEntries.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">{THAI_UI_LABELS.no_data_yet}</p>
            ) : (
              <div className="space-y-3">
                {platformEntries.map(([platform, count]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={platform as Platform} />
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-6">
        {/* Recent Post Logs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-blue-700 flex items-center gap-2">
              <History className="h-4 w-4" />
              ประวัติการโพสต์ล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent_post_logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                ยังไม่มีประวัติการโพสต์
              </p>
            ) : (
              <div className="space-y-3">
                {data.recent_post_logs.map((log) => {
                  const postUrl = getPostLogUrl(log);

                  return (
                    <div key={log.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <ProviderBadge provider={log.platform || log.provider} />
                            <Badge variant="outline" className={cn('h-6', statusBadgeClass(log.status))}>
                              {postLogStatusLabel(log.status)}
                            </Badge>
                            {log.page_name && (
                              <span className="text-xs font-medium text-gray-500 truncate">
                                {log.page_name}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {log.content_title}
                            </p>
                            {log.content_preview && (
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {log.content_preview}
                              </p>
                            )}
                          </div>
                          {log.error_message && (
                            <p className="text-xs text-red-600 line-clamp-2">
                              {log.error_message}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatDateTime(log.posted_at || log.created_at)}
                          </span>
                          {postUrl && (
                            <a href={postUrl} target="_blank" rel="noreferrer">
                              <Button size="sm" variant="outline" className="h-8">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                {getPostLogLinkLabel(log)}
                              </Button>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-blue-700 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              คิวโพสต์ล่วงหน้า
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              disabled={actionLoading !== null}
              onClick={resetStaleScheduledPosts}
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1', actionLoading === 'reset-stale' && 'animate-spin')} />
              รีเซ็ตคิวค้าง
            </Button>
          </CardHeader>
          <CardContent>
            {actionError && (
              <p className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                {actionError}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
              {(Object.keys(EMPTY_SCHEDULED_SUMMARY) as Array<keyof ScheduledPostSummary>).map((status) => (
                <div key={status} className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-center">
                  <p className="text-lg font-bold text-gray-900 leading-tight">
                    {data.scheduled_post_summary[status] || 0}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {SCHEDULED_STATUS_LABELS[status]}
                  </p>
                </div>
              ))}
            </div>

            {data.recent_scheduled_posts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                ยังไม่มีคิวโพสต์ล่วงหน้า
              </p>
            ) : (
              <div className="space-y-3">
                {data.recent_scheduled_posts.map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ProviderBadge provider={item.platform} />
                          <Badge variant="outline" className={cn('h-6', statusBadgeClass(item.status))}>
                            {scheduledStatusLabel(item.status)}
                          </Badge>
                          <span className="text-xs font-medium text-gray-500">
                            Retry {item.retry_count}/{item.max_retries}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.content_title}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.page_name || item.social_page_id}
                          </p>
                          {item.content_preview && (
                            <p className="text-xs text-gray-500 line-clamp-2">
                              {item.content_preview}
                            </p>
                          )}
                        </div>
                        {item.error_message && (
                          <p className="text-xs text-red-600 line-clamp-2">
                            {item.error_message}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-xs text-gray-500 sm:text-right">
                        <p>{formatDateTime(item.scheduled_at)}</p>
                        {item.locked_by && (
                          <p className="mt-1">Worker: {item.locked_by}</p>
                        )}
                        <div className="mt-2 flex flex-wrap justify-start gap-2 sm:justify-end">
                          {item.status === 'processing' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                disabled={actionLoading !== null}
                                onClick={() => resetProcessingPost(item.id)}
                              >
                                <RefreshCw className={cn('h-3.5 w-3.5 mr-1', actionLoading === `reset-${item.id}` && 'animate-spin')} />
                                รีเซ็ต
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-red-200 text-red-700 hover:bg-red-50"
                                disabled={actionLoading !== null}
                                onClick={() => markProcessingPostFailed(item.id)}
                              >
                                <XCircle className="h-3.5 w-3.5 mr-1" />
                                Mark failed
                              </Button>
                            </>
                          )}
                          {(item.status === 'pending' || item.status === 'failed') && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-gray-200 text-gray-700 hover:bg-gray-100"
                              disabled={actionLoading !== null}
                              onClick={() => cancelScheduledPost(item.id)}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              ยกเลิก
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.quick_actions}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: THAI_UI_LABELS.facebook_post, href: '/generate?platform=facebook&type=promotion_post', color: 'bg-blue-50 text-blue-700 border-blue-100' },
              { label: THAI_UI_LABELS.instagram_post, href: '/generate?platform=instagram&type=promotion_post', color: 'bg-pink-50 text-pink-700 border-pink-100' },
              { label: THAI_UI_LABELS.line_broadcast, href: '/generate?platform=line_oa&type=broadcast_message', color: 'bg-green-50 text-green-700 border-green-100' },
              { label: THAI_UI_LABELS.tiktok_script, href: '/generate?platform=tiktok&type=short_video_script', color: 'bg-gray-50 text-gray-700 border-gray-100' },
              { label: THAI_UI_LABELS.service_page, href: '/generate?platform=website&type=service_page_draft', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
              { label: THAI_UI_LABELS.new_campaign, href: '/campaigns', color: 'bg-purple-50 text-purple-700 border-purple-100' },
            ].map((action) => (
              <Link key={action.label} href={action.href}>
                <Button variant="outline" className={cn("w-full h-auto py-4 flex flex-col gap-2 border shadow-none hover:shadow-md transition-all", action.color)}>
                  <Plus className="h-4 w-4" />
                  <span className="text-[11px] font-bold tracking-tight">{action.label}</span>
                </Button>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
