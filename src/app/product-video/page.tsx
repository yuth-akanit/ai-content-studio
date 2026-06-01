'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { Clapperboard, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface SocialPage {
  id: string;
  name: string;
  provider: string;
  external_id?: string;
  meta?: {
    is_instagram?: boolean;
  } | null;
}

interface PreviewLogItem {
  preview_id: string;
  created_at: string;
  brand_context: string;
  target_page_key: string;
  selected_page_id: string;
  selected_page_name: string;
  platform: string;
  caption: string;
  preview_only: true;
  real_posting_enabled: false;
  line_broadcast_enabled: false;
  schedule_enabled: false;
  n8n_forwarded: boolean;
  n8n_status: number | null;
  response_body_exposed: false;
  status: 'pending_owner_review';
  publish_allowed: false;
  facebook_post_performed: false;
}

type BrandContext = 'syncflow' | 'paa_air';
type TargetPageKey = 'syncflow' | 'paa_air';

const defaultCaption = 'สร้างวิดีโอสินค้าแบบ preview เท่านั้น ยังไม่โพสต์จริง และยังไม่เปิด schedule';

function inferTargetPageKey(page: SocialPage | undefined): TargetPageKey {
  const raw = `${page?.name || ''} ${page?.provider || ''}`.toLowerCase();
  if (raw.includes('syncflow') || raw.includes('paa tech')) return 'syncflow';
  return 'paa_air';
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('th-TH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProductVideoPage() {
  const [pages, setPages] = useState<SocialPage[]>([]);
  const [previewLogs, setPreviewLogs] = useState<PreviewLogItem[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [brandContext, setBrandContext] = useState<BrandContext>('paa_air');
  const [targetPageKey, setTargetPageKey] = useState<TargetPageKey>('paa_air');
  const [caption, setCaption] = useState(defaultCaption);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId),
    [pages, selectedPageId],
  );

  async function loadPreviewLogs(showToast = false) {
    setLoadingLogs(true);
    try {
      const response = await fetch('/api/product-video/preview-logs');
      const data = await response.json();
      if (!response.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || 'โหลดคิวตรวจไม่สำเร็จ');
      }
      setPreviewLogs(data.items);
      if (showToast) toast.success('รีเฟรชคิวตรวจแล้ว');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'โหลดคิวตรวจไม่สำเร็จ';
      toast.error(message);
    } finally {
      setLoadingLogs(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/social-pages');
        const data = await response.json();
        if (!response.ok || !Array.isArray(data)) throw new Error('โหลดรายการเพจไม่สำเร็จ');

        setPages(data);
        if (data[0]?.id) {
          setSelectedPageId(data[0].id);
          const key = inferTargetPageKey(data[0]);
          setTargetPageKey(key);
          setBrandContext(key === 'syncflow' ? 'syncflow' : 'paa_air');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'โหลดรายการเพจไม่สำเร็จ';
        toast.error(message);
      } finally {
        setLoadingPages(false);
      }
    })();
    void loadPreviewLogs();
  }, []);

  function handlePageChange(pageId: string) {
    setSelectedPageId(pageId);
    const page = pages.find((item) => item.id === pageId);
    const key = inferTargetPageKey(page);
    setTargetPageKey(key);
    setBrandContext(key === 'syncflow' ? 'syncflow' : 'paa_air');
  }

  async function handleGeneratePreview() {
    if (!selectedPage) {
      toast.error('กรุณาเลือกเพจก่อน');
      return;
    }

    setSubmitting(true);
    setResult(null);

    try {
      const response = await fetch('/api/product-video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_context: brandContext,
          target_page_key: targetPageKey,
          selected_page_id: selectedPage.id,
          selected_page_name: selectedPage.name,
          platform: 'facebook_page',
          caption,
          preview_only: true,
          real_posting_enabled: false,
          line_broadcast_enabled: false,
          schedule_enabled: false,
        }),
      });

      const data = await response.json();
      setResult(data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'เตรียม payload ไม่สำเร็จ');
      }

      toast.success(data.preview_log_created ? 'บันทึก Preview Log เข้าคิวตรวจแล้ว' : 'เตรียม Product Video preview payload แล้ว');
      await loadPreviewLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'เตรียม Product Video preview ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Video"
        description="Phase 3A: ส่ง preview-only ไป n8n แล้วบันทึกคิว owner review โดยยังไม่เปิดโพสต์จริง"
        actions={(
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="h-3.5 w-3.5" />
            Safe Preview
          </Badge>
        )}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clapperboard className="h-5 w-5 text-blue-600" />
              ตั้งค่า Product Video
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {loadingPages ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <LoadingSpinner className="py-0" />
                กำลังโหลดเพจจาก /api/social-pages
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="social-page">Social Page</Label>
                <select
                  id="social-page"
                  value={selectedPageId}
                  onChange={(event) => handlePageChange(event.target.value)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name} · {page.provider}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand-context">brand_context</Label>
                <select
                  id="brand-context"
                  value={brandContext}
                  onChange={(event) => setBrandContext(event.target.value as BrandContext)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="paa_air">paa_air</option>
                  <option value="syncflow">syncflow</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-page-key">target_page_key</Label>
                <select
                  id="target-page-key"
                  value={targetPageKey}
                  onChange={(event) => setTargetPageKey(event.target.value as TargetPageKey)}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  <option value="paa_air">paa_air</option>
                  <option value="syncflow">syncflow</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">caption</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={5}
                placeholder="ใส่ caption สำหรับวิดีโอ"
              />
            </div>

            <Button onClick={handleGeneratePreview} disabled={submitting || !selectedPage} className="w-full sm:w-auto">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
              สร้าง Preview และเข้าคิวตรวจ
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Safety Guard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <div className="rounded-lg bg-green-50 p-3 text-green-800">preview_only=true</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">real_posting_enabled=false</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">line_broadcast_enabled=false</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">schedule_enabled=false</div>
            <div className="rounded-lg border border-gray-200 p-3">
              Client เรียกเฉพาะ <code>/api/product-video/generate</code> ไม่เรียก n8n โดยตรง
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Owner Review Queue</CardTitle>
          <Button variant="outline" size="sm" onClick={() => loadPreviewLogs(true)} disabled={loadingLogs}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loadingLogs ? 'animate-spin' : ''}`} />
            รีเฟรช
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingLogs ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <LoadingSpinner className="py-0" />
              กำลังโหลด preview logs
            </div>
          ) : previewLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-gray-500">
              ยังไม่มี Product Video preview ที่รอ owner review
            </div>
          ) : (
            previewLogs.map((item) => (
              <div key={item.preview_id} className="rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.selected_page_name}</div>
                    <div className="text-xs text-gray-500">{formatDate(item.created_at)} · {item.preview_id}</div>
                  </div>
                  <Badge variant="outline">รอตรวจ owner</Badge>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>brand_context: <span className="font-medium text-gray-900">{item.brand_context}</span></div>
                  <div>target_page_key: <span className="font-medium text-gray-900">{item.target_page_key}</span></div>
                  <div>platform: <span className="font-medium text-gray-900">{item.platform}</span></div>
                  <div>n8n_status: <span className="font-medium text-gray-900">{item.n8n_status}</span></div>
                </div>

                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{item.caption}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">preview_only=true</Badge>
                  <Badge variant="secondary">publish_allowed=false</Badge>
                  <Badge variant="secondary">facebook_post_performed=false</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" disabled>Approve — coming soon / design only</Button>
                  <Button size="sm" variant="outline" disabled>Reject — coming soon / design only</Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ผลลัพธ์จาก Server Wrapper</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
              {JSON.stringify(result, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
