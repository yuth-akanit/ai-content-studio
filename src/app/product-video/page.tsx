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

type PreviewLogStatus =
  | 'pending_owner_review'
  | 'approved_for_future_publish'
  | 'rejected'
  | 'changes_requested';

type PreviewDecision = 'approve' | 'reject' | 'request_changes';

type PublishPlanPreview = {
  plan_id: string;
  publish_plan_status: 'publish_plan_ready';
  publish_plan_checksum: string;
  target_page: {
    page_id: string;
    page_name: string;
    page_key: string;
    platform: string;
  };
  content: {
    caption: string;
    brand_context: string;
  };
  media: {
    media_status: 'not_rendered' | 'ready';
    media_type: 'video' | 'image' | null;
    media_url: string | null;
    public_media_url: string | null;
    media_checksum: string | null;
  };
  publish_allowed: false;
  facebook_post_performed: false;
  line_broadcast_performed: false;
  schedule_enabled: false;
  renderer_called: false;
  phaya_called: false;
  s3_upload_performed: false;
  mark_posted_performed: false;
};

type PublishAuthorization = {
  status: 'publish_authorized_for_manual_execution';
  authorization_id: string;
  idempotency_key: string;
  target_page_key: string;
  publish_plan_checksum: string;
  publish_allowed: false;
  facebook_post_performed: false;
  line_broadcast_performed: false;
  schedule_enabled: false;
  renderer_called: false;
  phaya_called: false;
  s3_upload_performed: false;
  mark_posted_performed: false;
};

type PublishExecutionDryRun = {
  status: 'publish_execution_blocked' | 'publish_execution_ready_dry_run';
  block_reason: 'media_not_rendered' | null;
  safe_to_audit: true;
  idempotency_key: string;
  target_page_key: string;
  publish_plan_checksum: string;
  publish_allowed: false;
  facebook_post_performed: false;
  line_broadcast_performed: false;
  schedule_enabled: false;
  renderer_called: false;
  phaya_called: false;
  s3_upload_performed: false;
  mark_posted_performed: false;
};

interface PreviewLogItem {
  preview_id: string;
  created_at: string;
  updated_at?: string;
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
  status: PreviewLogStatus;
  publish_allowed: false;
  facebook_post_performed: false;
  line_broadcast_performed: false;
  renderer_called: false;
  phaya_called: false;
  s3_upload_performed: false;
  mark_posted_performed: false;
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

function getStatusLabel(status: PreviewLogStatus): string {
  switch (status) {
    case 'approved_for_future_publish':
      return 'อนุมัติไว้สำหรับเผยแพร่ภายหลัง';
    case 'rejected':
      return 'ปฏิเสธแล้ว';
    case 'changes_requested':
      return 'ขอแก้ไข';
    case 'pending_owner_review':
    default:
      return 'รอตรวจ owner';
  }
}

function getDecisionSuccessMessage(decision: PreviewDecision): string {
  switch (decision) {
    case 'approve':
      return 'อนุมัติแบบ local แล้ว ยังไม่เผยแพร่จริง';
    case 'reject':
      return 'ปฏิเสธแบบ local แล้ว';
    case 'request_changes':
      return 'บันทึกคำขอแก้ไขแบบ local แล้ว';
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
  const [decidingPreviewId, setDecidingPreviewId] = useState<string | null>(null);
  const [loadingPublishPlanId, setLoadingPublishPlanId] = useState<string | null>(null);
  const [authorizingPreviewId, setAuthorizingPreviewId] = useState<string | null>(null);
  const [settingMediaPreviewId, setSettingMediaPreviewId] = useState<string | null>(null);
  const [dryRunningExecutionPreviewId, setDryRunningExecutionPreviewId] = useState<string | null>(null);
  const [publishPlanPreviews, setPublishPlanPreviews] = useState<Record<string, PublishPlanPreview>>({});
  const [publishAuthorizations, setPublishAuthorizations] = useState<Record<string, PublishAuthorization>>({});
  const [publishExecutionDryRuns, setPublishExecutionDryRuns] = useState<Record<string, PublishExecutionDryRun>>({});
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

  async function handlePreviewDecision(previewId: string, decision: PreviewDecision) {
    setDecidingPreviewId(previewId);
    setResult(null);

    try {
      const response = await fetch(`/api/product-video/preview-logs/${encodeURIComponent(previewId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json();
      setResult(data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'บันทึก decision ไม่สำเร็จ');
      }

      setPublishPlanPreviews((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      setPublishAuthorizations((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      setPublishExecutionDryRuns((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      toast.success(getDecisionSuccessMessage(decision));
      await loadPreviewLogs();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึก decision ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setDecidingPreviewId(null);
    }
  }

  async function handlePublishPlanPreview(previewId: string) {
    setLoadingPublishPlanId(previewId);
    setResult(null);

    try {
      const response = await fetch(`/api/product-video/preview-logs/${encodeURIComponent(previewId)}/publish-plan`);
      const data = await response.json();
      setResult(data);

      if (!response.ok || !data.ok || !data.publish_plan) {
        throw new Error(data.error || 'สร้าง Publish Plan Preview ไม่สำเร็จ');
      }

      setPublishPlanPreviews((current) => ({
        ...current,
        [previewId]: data.publish_plan as PublishPlanPreview,
      }));
      toast.success('สร้าง Publish Plan Preview แบบ read-only แล้ว ยังไม่โพสต์จริง');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'สร้าง Publish Plan Preview ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setLoadingPublishPlanId(null);
    }
  }

  async function handlePublishAuthorization(previewId: string) {
    const plan = publishPlanPreviews[previewId];
    if (!plan) {
      toast.error('ต้องสร้าง Publish Plan Preview ก่อน');
      return;
    }

    setAuthorizingPreviewId(previewId);
    setResult(null);

    try {
      const idempotencyKey = `manual-publish-auth-${previewId}-${plan.publish_plan_checksum}`;
      const response = await fetch(`/api/product-video/preview-logs/${encodeURIComponent(previewId)}/publish-authorization`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_page_key: plan.target_page.page_key,
          publish_plan_checksum: plan.publish_plan_checksum,
          idempotency_key: idempotencyKey,
          reason: 'owner confirmed local-only manual publish authorization gate',
        }),
      });
      const data = await response.json();
      setResult(data);

      if (!response.ok || !data.ok || !data.authorization) {
        throw new Error(data.error || 'บันทึก Publish Authorization ไม่สำเร็จ');
      }

      setPublishAuthorizations((current) => ({
        ...current,
        [previewId]: data.authorization as PublishAuthorization,
      }));
      toast.success('บันทึก Publish Authorization แบบ audit-only แล้ว ยังไม่โพสต์จริง');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'บันทึก Publish Authorization ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setAuthorizingPreviewId(null);
    }
  }

  async function handleMockMediaReady(previewId: string) {
    setSettingMediaPreviewId(previewId);
    setResult(null);

    try {
      const response = await fetch(`/api/product-video/preview-logs/${encodeURIComponent(previewId)}/media-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_id: previewId,
          media_type: 'video',
          public_media_url: `https://admin.paaair.online/media/product-video/${previewId}.mp4`,
          media_checksum: `mock-${previewId}`,
        }),
      });
      const data = await response.json();
      setResult(data);

      if (!response.ok || !data.ok || !data.metadata) {
        throw new Error(data.error || 'ตั้งค่า mock media metadata ไม่สำเร็จ');
      }

      setPublishPlanPreviews((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      setPublishAuthorizations((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      setPublishExecutionDryRuns((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      toast.success('ตั้งค่า mock media-ready metadata แล้ว กรุณาสร้าง Publish Plan ใหม่');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ตั้งค่า mock media metadata ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setSettingMediaPreviewId(null);
    }
  }

  async function handlePublishExecutionDryRun(previewId: string) {
    const authorization = publishAuthorizations[previewId];
    if (!authorization) {
      toast.error('ต้อง Authorize publish manually ก่อน');
      return;
    }

    setDryRunningExecutionPreviewId(previewId);
    setResult(null);

    try {
      const response = await fetch(`/api/product-video/preview-logs/${encodeURIComponent(previewId)}/publish-execution-dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_page_key: authorization.target_page_key,
          publish_plan_checksum: authorization.publish_plan_checksum,
          idempotency_key: authorization.idempotency_key,
        }),
      });
      const data = await response.json();
      setResult(data);

      if (!response.ok || !data.ok || !data.audit) {
        throw new Error(data.error || 'รัน Publish Executor Dry-run ไม่สำเร็จ');
      }

      setPublishExecutionDryRuns((current) => ({
        ...current,
        [previewId]: data.audit as PublishExecutionDryRun,
      }));
      toast.success('Dry-run executor ถูก block ที่ media_status=not_rendered และบันทึก audit แล้ว');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'รัน Publish Executor Dry-run ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setDryRunningExecutionPreviewId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Video"
        description="Phase 4B: Mock Media-Ready Gate แบบ local-only ทำให้ dry-run executor ผ่าน media gate โดยยังไม่โพสต์จริง"
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
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">publish_allowed=false</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">real_posting_enabled=false</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">line_broadcast_enabled=false</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">schedule_enabled=false</div>
            <div className="rounded-lg bg-blue-50 p-3 text-blue-800">renderer_called=false · phaya_called=false · s3_upload_performed=false</div>
            <div className="rounded-lg border border-gray-200 p-3">
              Decision ใน Owner Review Queue เป็น local approval เท่านั้น ไม่ใช่ permission ให้โพสต์จริง
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              Publish Plan Preview แสดง target page / caption / media plan เท่านั้น และยังคง publish_allowed=false
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              Publish Authorization เป็น local audit เท่านั้น ใช้ยืนยัน manual execution gate แต่ยังคง real_posting_enabled=false
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              Publish Executor Dry-run ตรวจ authorization + checksum + idempotency แล้วผ่าน media gate ได้เมื่อ media_status=ready จาก mock metadata
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              Client เรียกเฉพาะ <code>/api/product-video/generate</code>, <code>/decision</code>, <code>/media-metadata</code>, <code>/publish-plan</code>, <code>/publish-authorization</code> และ <code>/publish-execution-dry-run</code>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Owner Review Queue</CardTitle>
            <p className="mt-1 text-xs text-gray-500">Local only: approved_for_future_publish → mock media ready → publish_plan_ready → publish_authorized_for_manual_execution → publish_execution_ready_dry_run</p>
          </div>
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
                  <Badge variant="outline">{getStatusLabel(item.status)}</Badge>
                </div>

                <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>brand_context: <span className="font-medium text-gray-900">{item.brand_context}</span></div>
                  <div>target_page_key: <span className="font-medium text-gray-900">{item.target_page_key}</span></div>
                  <div>platform: <span className="font-medium text-gray-900">{item.platform}</span></div>
                  <div>status: <span className="font-medium text-gray-900">{item.status}</span></div>
                  <div>n8n_status: <span className="font-medium text-gray-900">{item.n8n_status}</span></div>
                </div>

                <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{item.caption}</p>

                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">preview_only=true</Badge>
                  <Badge variant="secondary">publish_allowed=false</Badge>
                  <Badge variant="secondary">facebook_post_performed=false</Badge>
                  <Badge variant="secondary">line_broadcast_performed=false</Badge>
                  <Badge variant="secondary">schedule_enabled=false</Badge>
                  <Badge variant="secondary">renderer_called=false</Badge>
                  <Badge variant="secondary">phaya_called=false</Badge>
                  <Badge variant="secondary">s3_upload_performed=false</Badge>
                  <Badge variant="secondary">mark_posted_performed=false</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => handlePreviewDecision(item.preview_id, 'approve')}
                    disabled={decidingPreviewId === item.preview_id}
                  >
                    {decidingPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Approve for future publish
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreviewDecision(item.preview_id, 'reject')}
                    disabled={decidingPreviewId === item.preview_id}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePreviewDecision(item.preview_id, 'request_changes')}
                    disabled={decidingPreviewId === item.preview_id}
                  >
                    Request changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleMockMediaReady(item.preview_id)}
                    disabled={item.status !== 'approved_for_future_publish' || settingMediaPreviewId === item.preview_id}
                    title={item.status === 'approved_for_future_publish' ? 'ตั้งค่า mock media-ready metadata แบบ local-only' : 'ต้อง approved_for_future_publish ก่อน'}
                  >
                    {settingMediaPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Set mock media ready
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePublishPlanPreview(item.preview_id)}
                    disabled={item.status !== 'approved_for_future_publish' || loadingPublishPlanId === item.preview_id}
                    title={item.status === 'approved_for_future_publish' ? 'สร้าง publish plan preview แบบ read-only' : 'ต้อง approved_for_future_publish ก่อน'}
                  >
                    {loadingPublishPlanId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Preview publish plan
                  </Button>
                </div>

                {publishPlanPreviews[item.preview_id] ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Publish Plan Preview</div>
                      <Badge variant="secondary">publish_plan_ready</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div>target page: <span className="font-medium">{publishPlanPreviews[item.preview_id].target_page.page_name}</span></div>
                      <div>platform: <span className="font-medium">{publishPlanPreviews[item.preview_id].target_page.platform}</span></div>
                      <div>media: <span className="font-medium">{publishPlanPreviews[item.preview_id].media.media_status}</span></div>
                      <div>media_type: <span className="font-medium">{publishPlanPreviews[item.preview_id].media.media_type || '-'}</span></div>
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div className="sm:col-span-2">checksum: <span className="font-mono text-[11px]">{publishPlanPreviews[item.preview_id].publish_plan_checksum}</span></div>
                    </div>
                    <p className="whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-xs text-blue-950">
                      {publishPlanPreviews[item.preview_id].content.caption}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="secondary">read_only=true</Badge>
                      <Badge variant="secondary">facebook_post_performed=false</Badge>
                      <Badge variant="secondary">line_broadcast_performed=false</Badge>
                      <Badge variant="secondary">schedule_enabled=false</Badge>
                      <Badge variant="secondary">renderer_called=false</Badge>
                      <Badge variant="secondary">phaya_called=false</Badge>
                      <Badge variant="secondary">s3_upload_performed=false</Badge>
                      <Badge variant="secondary">mark_posted_performed=false</Badge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handlePublishAuthorization(item.preview_id)}
                      disabled={authorizingPreviewId === item.preview_id}
                    >
                      {authorizingPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Authorize publish manually
                    </Button>
                  </div>
                ) : null}

                {publishAuthorizations[item.preview_id] ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Final Publish Authorization Gate</div>
                      <Badge variant="secondary">publish_authorized_for_manual_execution</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div>target_page_key: <span className="font-medium">{publishAuthorizations[item.preview_id].target_page_key}</span></div>
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div>facebook_post_performed: <span className="font-medium">false</span></div>
                      <div>idempotency_key: <span className="font-mono text-[11px]">{publishAuthorizations[item.preview_id].idempotency_key}</span></div>
                    </div>
                    <p className="text-xs">Audit-only authorization created. Real publish ยังต้องทำใน Phase 4 แบบ one-shot guarded execution เท่านั้น</p>
                    <Button
                      size="sm"
                      onClick={() => handlePublishExecutionDryRun(item.preview_id)}
                      disabled={dryRunningExecutionPreviewId === item.preview_id}
                    >
                      {dryRunningExecutionPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Run guarded dry-run executor
                    </Button>
                  </div>
                ) : null}

                {publishExecutionDryRuns[item.preview_id] ? (
                  <div className="mt-4 space-y-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Guarded Publish Executor Dry-run</div>
                      <Badge variant="secondary">{publishExecutionDryRuns[item.preview_id].status}</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div>block_reason: <span className="font-medium">{publishExecutionDryRuns[item.preview_id].block_reason || 'none'}</span></div>
                      <div>safe_to_audit: <span className="font-medium">true</span></div>
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div>facebook_post_performed: <span className="font-medium">false</span></div>
                    </div>
                    <p className="text-xs">Dry-run เท่านั้น: ไม่เรียก Facebook, LINE, n8n, renderer, schedule, S3 หรือ mark posted</p>
                  </div>
                ) : null}
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
