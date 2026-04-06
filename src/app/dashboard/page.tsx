'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  hasProfile: boolean;
  profileId: string | null;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      // Try to get profile
      const profilesRes = await fetch('/api/profiles');
      const profiles = await profilesRes.json();
      const profile = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;

      if (!profile) {
        setData({
          stats: { total: 0, byPlatform: {}, byType: {}, recentCount: 0 },
          recentContents: [],
          campaigns: [],
          hasProfile: false,
          profileId: null,
        });
        setLoading(false);
        return;
      }

      // Load content and campaigns
      const [contentRes, campaignsRes] = await Promise.all([
        fetch(`/api/content?profile_id=${profile.id}&limit=5`),
        fetch(`/api/campaigns?profile_id=${profile.id}`),
      ]);

      const contentData = await contentRes.json();
      const campaigns = await campaignsRes.json();

      // Calculate stats from contents
      const allContentsRes = await fetch(`/api/content?profile_id=${profile.id}&limit=1000`);
      const allContents = await allContentsRes.json();
      const contents: GeneratedContent[] = allContents.data || [];

      const byPlatform: Record<string, number> = {};
      const byType: Record<string, number> = {};
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let recentCount = 0;

      contents.forEach((c) => {
        byPlatform[c.platform] = (byPlatform[c.platform] || 0) + 1;
        byType[c.content_type] = (byType[c.content_type] || 0) + 1;
        if (c.created_at >= sevenDaysAgo) recentCount++;
      });

      setData({
        stats: { total: contents.length, byPlatform, byType, recentCount },
        recentContents: contentData.data || [],
        campaigns: Array.isArray(campaigns) ? campaigns : [],
        hasProfile: true,
        profileId: profile.id,
      });
    } catch {
      setData({
        stats: { total: 0, byPlatform: {}, byType: {}, recentCount: 0 },
        recentContents: [],
        campaigns: [],
        hasProfile: false,
        profileId: null,
      });
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner text={THAI_UI_LABELS.loading_dashboard} />;
  if (!data) return null;

  if (!data.hasProfile) {
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
