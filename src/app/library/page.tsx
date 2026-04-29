'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile } from '@/context/profile-context';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { OutputDisplay } from '@/components/content/output-display';
import {
  Library,
  Search,
  Eye,
  Copy,
  Trash2,
  Archive,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Platform,
  ContentType,
  GeneratedContent,
  PLATFORMS,
  CONTENT_TYPES,
  PLATFORM_LABELS,
  CONTENT_TYPE_LABELS,
} from '@/types/database';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

export default function LibraryPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [contents, setContents] = useState<GeneratedContent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<GeneratedContent | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const pageSize = 12;

  const loadContents = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ profile_id: pid, limit: String(pageSize), offset: String(page * pageSize) });
      if (platformFilter) params.set('platform', platformFilter);
      if (typeFilter) params.set('content_type', typeFilter);
      if (search) params.set('search', search);

      const res = await fetch(`/api/content?${params}`);
      const data = await res.json();
      setContents(data.data || []);
      setTotalCount(data.count || 0);
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_load);
    } finally {
      setLoading(false);
    }
  }, [page, platformFilter, typeFilter, search]);

  useEffect(() => {
    if (profile?.id) loadContents(profile.id);
  }, [profile?.id, loadContents]);

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/content/${id}`, { method: 'DELETE' });
      toast.success(THAI_UI_LABELS.content_deleted);
      if (profile?.id) loadContents(profile.id);
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_delete);
    }
  }

  async function handleArchive(id: string) {
    try {
      await fetch(`/api/content/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      toast.success(THAI_UI_LABELS.content_archived);
      if (profile?.id) loadContents(profile.id);
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_archive);
    }
  }

  async function copyContent(content: GeneratedContent) {
    const output = content.output_payload;
    const text = [output?.title, output?.opening_hook, output?.body, output?.cta]
      .filter(Boolean)
      .join('\n\n');
    await navigator.clipboard.writeText(text);
    toast.success(THAI_UI_LABELS.copied_to_clipboard);
  }

  if (!profile?.id && !profileLoading) {
    return (
      <div>
        <PageHeader title={THAI_UI_LABELS.content_library} />
        <EmptyState
          icon={Library}
          title={THAI_UI_LABELS.no_data_yet}
          description={THAI_UI_LABELS.start_generating_desc}
          actionLabel={THAI_UI_LABELS.create_profile_btn}
          onAction={() => (window.location.href = '/profile')}
        />
      </div>
    );
  }

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div>
      <PageHeader
        title={THAI_UI_LABELS.content_library}
        description={`${totalCount} ${THAI_UI_LABELS.content_items_count}`}
        actions={
          <Button onClick={() => (window.location.href = '/generate')} className="bg-blue-600 hover:bg-blue-700">
            <Sparkles className="h-4 w-4 mr-2" />
            {THAI_UI_LABELS.generate_new}
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder={THAI_UI_LABELS.search_placeholder}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(0); }}
        >
          <option value="">{THAI_UI_LABELS.all_platforms}</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
        >
          <option value="">{THAI_UI_LABELS.all_types}</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-[250px] animate-pulse">
              <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-15" />
                </div>
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="space-y-2 pt-2">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : contents.length === 0 ? (
        <EmptyState
          icon={Library}
          title={THAI_UI_LABELS.no_content_found}
          description={search || platformFilter || typeFilter
            ? THAI_UI_LABELS.adjust_filters
            : THAI_UI_LABELS.start_generating_desc}
          actionLabel={THAI_UI_LABELS.generate_content_btn}
          onAction={() => (window.location.href = '/generate')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contents.map((content) => (
              <Card key={content.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-3">
                    <PlatformBadge platform={content.platform} />
                    <Badge variant="secondary" className="text-[10px]">
                      {content.status}
                    </Badge>
                  </div>
                  <h3 className="font-medium text-sm mb-1 line-clamp-2">
                    {content.output_payload?.title || content.topic || CONTENT_TYPE_LABELS[content.content_type as ContentType] || content.content_type}
                  </h3>
                  <p className="text-xs text-gray-500 mb-1">
                    {CONTENT_TYPE_LABELS[content.content_type as ContentType]}
                  </p>
                  <p className="text-xs text-gray-400 mb-3">
                    {new Date(content.created_at).toLocaleDateString('th-TH', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </p>
                  {content.output_payload?.body && (
                    <p className="text-xs text-gray-600 line-clamp-3 mb-3">
                      {content.output_payload.body}
                    </p>
                  )}
                  <div className="flex items-center gap-1 pt-2 border-t border-gray-100">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => setSelectedContent(content)}>
                      <Eye className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.view_btn}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => copyContent(content)}>
                      <Copy className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.copy_btn}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleArchive(content.id)}>
                      <Archive className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.archive_btn}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(content.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

            <div className="flex items-center justify-center gap-2 mt-6 pb-8">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="text-xs">
                {THAI_UI_LABELS.previous_btn}
              </Button>
              <span className="text-xs text-gray-500 font-medium">
                {THAI_UI_LABELS.page_info.replace('{page}', String(page + 1)).replace('{total}', String(totalPages))}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="text-xs">
                {THAI_UI_LABELS.next_btn}
              </Button>
            </div>
        </>
      )}

      {/* Content Preview Dialog */}
      <Dialog open={!!selectedContent} onOpenChange={() => setSelectedContent(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-blue-700">{THAI_UI_LABELS.content_preview}</DialogTitle>
          </DialogHeader>
          {selectedContent && (
            <OutputDisplay
              output={selectedContent.output_payload}
              platform={selectedContent.platform}
              contentId={selectedContent.id}
              imageUrls={selectedContent.input_payload?.image_urls}
              videoUrl={selectedContent.input_payload?.video_url}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
