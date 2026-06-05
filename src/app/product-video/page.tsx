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
  status?: string;
  external_id?: string;
  meta?: {
    is_instagram?: boolean;
    access_token_present?: boolean;
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

type ManualPublishExecution = {
  status: 'blocked' | 'published';
  block_reason: 'real_posting_flag_off' | null;
  manual_execution: true;
  safe_to_audit: true;
  idempotency_key: string;
  target_page_key: string;
  publish_plan_checksum: string;
  publish_allowed: false;
  real_posting_enabled: false;
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
  selected_channel_id?: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id?: string;
  facebook_page_id?: string;
  platform: string;
  caption: string;
  marketing_caption?: string;
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

  // New fields
  asset_id?: string;
  uploaded_asset_id?: string;
  public_image_url?: string;
  image_urls?: string[];
  brief?: string;
  selected_pages?: string;
  video_title?: string;
  hook?: string;
  scene_script?: string;
  overlay_texts?: string;
  hashtags?: string;
  render_job_id?: string;
  render_status?: string;
  public_media_url?: string;
  media_type?: string;
  media_checksum?: string;
  media_status?: string;
}

type BrandContext = 'syncflow' | 'paa_air';
type TargetPageKey = 'syncflow' | 'paa_air';

const syncflowDefaultCaption = `ลูกค้าทักมาหลายช่องทาง แต่งานไม่ควรหลุดเพราะตอบไม่ทัน

ถ้าทีมแอดมินต้องไล่ตอบ LINE, Facebook, Instagram และโทรศัพท์พร้อมกัน โอกาสพลาดคิว พลาดงาน และตอบลูกค้าช้าจะสูงมาก

SyncFlow ช่วยรวมงานจากหลายช่องทางให้กลายเป็นระบบเดียว ตั้งแต่รับเรื่อง จัดคิว ติดตามสถานะ ไปจนถึงแจ้งเตือนทีมงาน

เหมาะกับธุรกิจบริการที่มีแอดมินหลายคน งานเข้าหลายช่องทาง และต้องการลดงานหลุดโดยไม่เพิ่มคน

สนใจดูตัวอย่างระบบ ทัก SyncFlow by PAA Tech

#SyncFlow #ระบบจัดการงาน #ธุรกิจบริการ #AIContentStudio #จัดคิวงาน #ลดงานหลุด`;

const paaAirDefaultCaption = `แอร์ไม่เย็น มีกลิ่นอับ น้ำหยด ปัญหาชวนปวดหัวในช่วงหน้าร้อน!

ปล่อยไว้นานอาจทำให้ค่าไฟพุ่งกระฉูด แถมยังเป็นแหล่งสะสมของเชื้อโรคและฝุ่นละออง PM2.5 ที่ส่งผลเสียต่อสุขภาพครอบครัวคุณ

PAA Air บริการล้างแอร์ฆ่าเชื้อโรคด้วยทีมช่างมืออาชีพ ล้างสะอาดทุกซอกทุกมุม ตรวจเช็กระบบน้ำยาแอร์ฟรี

ให้บริการในพื้นที่กรุงเทพฯ และปริมณฑล สะดวกรวดเร็ว นัดง่าย ตรงเวลา

สนใจจองคิวบริการ ทัก PAA Air ได้ทันที

#PAAAir #ล้างแอร์ #ซ่อมแอร์ #ช่างแอร์ #แอร์บ้าน #กรุงเทพ`;

async function safeParseJson(response: Response, context = 'API request'): Promise<any> {
  const text = await response.text();
  const url = response.url;
  const http_status = response.status;

  if (!text || text.trim() === '') {
    return {
      ok: false,
      error: 'product_video_api_empty_response',
      message: `Empty response received from API during ${context}.`,
      context,
      http_status,
      url,
      body_preview: '',
    };
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    const snippet = text.slice(0, 150);
    return {
      ok: false,
      error: 'product_video_api_invalid_json',
      message: `Invalid JSON response received during ${context}.`,
      context,
      http_status,
      url,
      body_preview: snippet,
    };
  }
}

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

function isRenderedWithMedia(data: any): boolean {
  const status = typeof data?.status === 'string' ? data.status : '';
  const renderStatus = typeof data?.render_status === 'string' ? data.render_status : '';
  const publicMediaUrl = typeof data?.public_media_url === 'string' ? data.public_media_url.trim() : '';

  return publicMediaUrl.length > 0 && (status === 'rendered' || renderStatus === 'rendered');
}

function getBrandPageMismatchMessage(item: PreviewLogItem): string | null {
  if (item.brand_context === 'syncflow' && item.target_page_key !== 'syncflow') {
    return 'Brand/page mismatch: syncflow must target syncflow';
  }

  if (item.brand_context === 'paa_air' && item.target_page_key !== 'paa_air') {
    return 'Brand/page mismatch: paa_air must target paa_air';
  }

  return null;
}

function getFacebookPageId(item: PreviewLogItem, plan?: PublishPlanPreview): string {
  return item.facebook_page_id || item.external_id || plan?.target_page.page_id || item.selected_page_id || '-';
}

function ContextField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/65 p-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`${mono ? 'font-mono text-[10px]' : 'font-medium text-gray-950'} break-all`}>{value || '-'}</div>
    </div>
  );
}

export default function ProductVideoPage() {
  const [pages, setPages] = useState<SocialPage[]>([]);
  const [previewLogs, setPreviewLogs] = useState<PreviewLogItem[]>([]);
  const [loadingPages, setLoadingPages] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [brandContext, setBrandContext] = useState<BrandContext>('paa_air');
  const [targetPageKey, setTargetPageKey] = useState<TargetPageKey>('paa_air');
  const [caption, setCaption] = useState('');

  // Asset upload states
  const [uploading, setUploading] = useState(false);
  const [uploadedAssetId, setUploadedAssetId] = useState('');
  const [uploadedFilename, setUploadedFilename] = useState('');
  const [uploadedPublicImageUrl, setUploadedPublicImageUrl] = useState('');
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState('');

  // User brief state
  const [brief, setBrief] = useState('');

  // Mock Render state tracker
  const [renderingPreviewId, setRenderingPreviewId] = useState<string | null>(null);
  const [renderingJobId, setRenderingJobId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<string>('');

  useEffect(() => {
    setCaption(brandContext === 'syncflow' ? syncflowDefaultCaption : paaAirDefaultCaption);
  }, [brandContext]);

  const [submitting, setSubmitting] = useState(false);
  const [decidingPreviewId, setDecidingPreviewId] = useState<string | null>(null);
  const [loadingPublishPlanId, setLoadingPublishPlanId] = useState<string | null>(null);
  const [authorizingPreviewId, setAuthorizingPreviewId] = useState<string | null>(null);
  const [settingMediaPreviewId, setSettingMediaPreviewId] = useState<string | null>(null);
  const [dryRunningExecutionPreviewId, setDryRunningExecutionPreviewId] = useState<string | null>(null);
  const [manualPublishingPreviewId, setManualPublishingPreviewId] = useState<string | null>(null);
  const [publishPlanPreviews, setPublishPlanPreviews] = useState<Record<string, PublishPlanPreview>>({});
  const [publishAuthorizations, setPublishAuthorizations] = useState<Record<string, PublishAuthorization>>({});
  const [publishExecutionDryRuns, setPublishExecutionDryRuns] = useState<Record<string, PublishExecutionDryRun>>({});
  const [manualPublishExecutions, setManualPublishExecutions] = useState<Record<string, ManualPublishExecution>>({});
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === selectedPageId),
    [pages, selectedPageId],
  );

  async function loadPreviewLogs(showToast = false) {
    setLoadingLogs(true);
    try {
      const response = await fetch('/api/product-video/preview-logs');
      const data = await safeParseJson(response, 'loading preview logs');
      if (!response.ok || !data.ok || !Array.isArray(data.items)) {
        throw new Error(data.error || data.message || 'โหลดคิวตรวจไม่สำเร็จ');
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
        const response = await fetch('/api/social-pages?provider=facebook&status=active');
        const data = await safeParseJson(response, 'fetching social pages');
        if (!response.ok || !Array.isArray(data)) throw new Error(data.error || data.message || 'โหลดรายการเพจไม่สำเร็จ');

        setPages(data);
        if (data[0]?.id) {
          setSelectedPageId(data[0].id);
          setSelectedPageIds([data[0].id]);
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
    setSelectedPageIds([pageId]);
    const page = pages.find((item) => item.id === pageId);
    const key = inferTargetPageKey(page);
    setTargetPageKey(key);
    setBrandContext(key === 'syncflow' ? 'syncflow' : 'paa_air');
  }

  function handlePageCheckboxChange(pageId: string, checked: boolean) {
    setSelectedPageIds((current) => {
      if (checked) {
        return [...current, pageId];
      } else {
        return current.filter((id) => id !== pageId);
      }
    });
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError('');
    setUploadedAssetId('');
    setUploadedFilename('');
    setUploadedPublicImageUrl('');
    setUploadedImageUrls([]);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/product-video/assets/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await safeParseJson(response, 'uploading image file');
      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.message || 'อัปโหลดรูปภาพไม่สำเร็จ');
      }

      const publicImageUrl = typeof data.public_image_url === 'string' ? data.public_image_url.trim() : '';
      const imageUrls = Array.isArray(data.image_urls) ? data.image_urls.filter((url: unknown): url is string => typeof url === 'string' && url.trim().length > 0) : [];
      if (!publicImageUrl || imageUrls.length === 0) {
        throw new Error('อัปโหลดแล้วแต่ยังไม่ได้ public image URL สำหรับ renderer');
      }

      setUploadedAssetId(data.asset_id);
      setUploadedFilename(data.filename);
      setUploadedPublicImageUrl(publicImageUrl);
      setUploadedImageUrls(imageUrls);
      toast.success('อัปโหลดรูปภาพเสร็จสิ้น พร้อม public URL สำหรับ renderer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'อัปโหลดรูปภาพไม่สำเร็จ';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleGeneratePreview() {
    if (selectedPageIds.length === 0) {
      toast.error('กรุณาเลือกเพจอย่างน้อยหนึ่งเพจ');
      return;
    }

    if (!uploadedPublicImageUrl || uploadedImageUrls.length === 0) {
      toast.error('กรุณาอัปโหลดรูปภาพให้ได้ public image URL ก่อนสร้าง preview');
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
          selected_pages: selectedPageIds,
          selected_channel_id: selectedPageIds[0],
          selected_page_id: selectedPageIds[0],
          platform: 'facebook_page',
          caption,
          marketing_caption: caption,
          brief,
          asset_id: uploadedAssetId,
          uploaded_asset_id: uploadedAssetId,
          public_image_url: uploadedPublicImageUrl,
          image_urls: uploadedImageUrls,
          preview_note: 'สร้างวิดีโอสินค้าแบบ preview เท่านั้น ยังไม่โพสต์จริง และยังไม่เปิด schedule',
          preview_only: true,
          real_posting_enabled: false,
          line_broadcast_enabled: false,
          schedule_enabled: false,
        }),
      });

      const data = await safeParseJson(response, 'generating preview');
      setResult(data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.message || 'เตรียม payload ไม่สำเร็จ');
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

  async function handleRenderRequest(previewId: string) {
    const item = previewLogs.find((p) => p.preview_id === previewId);
    if (!item) return;
    if (!item.public_image_url || !item.image_urls?.length) {
      toast.error('ต้องมี public_image_url จากรูปที่อัปโหลดก่อน Generate Video Preview');
      return;
    }

    toast.dismiss();
    setRenderingPreviewId(previewId);
    setRenderingJobId(null);
    setRenderStatus('initializing');
    setResult(null);

    try {
      const response = await fetch('/api/product-video/render-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preview_id: previewId,
          brand_context: item.brand_context,
          asset_id: item.asset_id || item.uploaded_asset_id || '',
          uploaded_asset_id: item.uploaded_asset_id || item.asset_id || '',
          public_image_url: item.public_image_url || '',
          image_urls: item.image_urls || [],
          brief: item.brief || '',
          marketing_caption: item.marketing_caption || item.caption,
          scene_script: item.scene_script || '',
          overlay_texts: item.overlay_texts || '',
          selected_pages: item.selected_pages ? JSON.parse(item.selected_pages) : [],
          target_page_key: item.target_page_key,
          selected_page_id: item.selected_page_id,
          selected_page_name: item.selected_page_name,
        }),
      });

      const data = await safeParseJson(response, 'submitting render request');
      setResult(data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.message || 'ส่งคำขอ render ไม่สำเร็จ');
      }

      const nextStatus = typeof data.render_status === 'string' ? data.render_status : data.status;
      setRenderStatus(nextStatus);
      setRenderingJobId(data.render_job_id || data.job_id || null);

      if (isRenderedWithMedia(data)) {
        setRenderingPreviewId(null);
        setRenderingJobId(null);
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
        toast.success('การ Render เสร็จสิ้น! วิดีโอพร้อมแสดงผล');
        await loadPreviewLogs();
        return;
      }

      toast.success(`รับคำสั่ง Render แล้ว สถานะ: ${nextStatus}`);

      if (data.job_id || data.render_job_id) {
        pollRenderStatus(data.render_job_id || data.job_id, previewId);
      } else {
        setRenderingPreviewId(null);
        setRenderingJobId(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ส่งคำขอ render ไม่สำเร็จ';
      toast.error(message);
      setRenderingPreviewId(null);
      setRenderingJobId(null);
      setRenderStatus('');
    }
  }

  async function pollRenderStatus(jobId: string, previewId: string) {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 15) {
        clearInterval(interval);
        setRenderingPreviewId(null);
        setRenderingJobId(null);
        setRenderStatus('timeout');
        toast.error('การ Render หมดเวลา (กรุณากด Set mock media ready หรือกด Render ใหม่)');
        return;
      }

      try {
        const response = await fetch(`/api/product-video/render-status/${encodeURIComponent(jobId)}`);
        const data = await safeParseJson(response, 'checking render status');

        if (!response.ok || !data.ok) {
          clearInterval(interval);
          setRenderingPreviewId(null);
          setRenderingJobId(null);
          setRenderStatus('failed');
          toast.error(data.message || 'การ Render ล้มเหลว');
          return;
        }

        setRenderStatus(data.status);
        if (isRenderedWithMedia(data) || data.status === 'mock_render_ready') {
          clearInterval(interval);
          setRenderingPreviewId(null);
          setRenderingJobId(null);

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

          toast.success('การ Render เสร็จสิ้น! วิดีโอพร้อมแสดงผล');
          await loadPreviewLogs();
        }
      } catch (error) {
        console.error('error polling render status', error);
      }
    }, 2000);
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
      const data = await safeParseJson(response, 'submitting preview decision');
      setResult(data);

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.message || 'บันทึก decision ไม่สำเร็จ');
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
      setManualPublishExecutions((current) => {
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
      const data = await safeParseJson(response, 'generating publish plan preview');
      setResult(data);

      if (!response.ok || !data.ok || !data.publish_plan) {
        throw new Error(data.error || data.message || 'สร้าง Publish Plan Preview ไม่สำเร็จ');
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
      const idempotencyKey = `manual-publish-auth-${previewId}-${plan.target_page.page_id}-${plan.publish_plan_checksum}`;
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
      const data = await safeParseJson(response, 'submitting publish authorization');
      setResult(data);

      if (!response.ok || !data.ok || !data.authorization) {
        throw new Error(data.error || data.message || 'บันทึก Publish Authorization ไม่สำเร็จ');
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
      const data = await safeParseJson(response, 'setting mock media metadata');
      setResult(data);

      if (!response.ok || !data.ok || !data.metadata) {
        throw new Error(data.error || data.message || 'ตั้งค่า mock media metadata ไม่สำเร็จ');
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
      setManualPublishExecutions((current) => {
        const next = { ...current };
        delete next[previewId];
        return next;
      });
      toast.success('ตั้งค่า mock media-ready metadata แล้ว กรุณาสร้าง Publish Plan ใหม่');
      await loadPreviewLogs();
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
      const data = await safeParseJson(response, 'running dry-run execution');
      setResult(data);

      if (!response.ok || !data.ok || !data.audit) {
        throw new Error(data.error || data.message || 'รัน Publish Executor Dry-run ไม่สำเร็จ');
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

  async function handleManualPublishExecute(item: PreviewLogItem) {
    const previewId = item.preview_id;
    const authorization = publishAuthorizations[previewId];
    if (!authorization) {
      toast.error('ต้อง Authorize publish manually ก่อน');
      return;
    }

    setManualPublishingPreviewId(previewId);
    setResult(null);

    try {
      const response = await fetch(`/api/product-video/preview-logs/${encodeURIComponent(previewId)}/publish-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual_execute: true,
          request_scoped_real_publish_approval: true,
          target_page_key: authorization.target_page_key,
          publish_plan_checksum: authorization.publish_plan_checksum,
          idempotency_key: authorization.idempotency_key,
          selected_channel_id: item.selected_channel_id || item.selected_page_id,
        }),
      });
      const data = await safeParseJson(response, 'executing manual publish');
      setResult(data);

      if (!response.ok || !data.ok || !data.execution) {
        throw new Error(data.error || data.message || 'Manual publish executor ไม่สำเร็จ');
      }

      setManualPublishExecutions((current) => ({
        ...current,
        [previewId]: data.execution as ManualPublishExecution,
      }));
      toast.success(data.status === 'blocked'
        ? 'Publish to Facebook ถูก block เพราะ real publish flag ยังไม่เปิด และไม่มีการเรียก Facebook'
        : 'Publish to Facebook สำเร็จ');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Manual publish executor ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setManualPublishingPreviewId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Product Video"
        description="Upgrade AI Product Video Workflow: deterministic mock copy, assets, rendering logs, multi-page publish queue preview, and authorization audit gates"
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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="social-page">Social Page (Primary Page)</Label>
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

                <div className="space-y-2">
                  <Label>เลือก Facebook Pages ทั้งหมดที่จะโพสต์ (Multi-Page Queue Selection)</Label>
                  <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/50 p-3 max-h-40 overflow-y-auto">
                    {pages.map((page) => (
                      <label key={page.id} className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedPageIds.includes(page.id)}
                          onChange={(e) => handlePageCheckboxChange(page.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>{page.name} ({page.provider})</span>
                      </label>
                    ))}
                  </div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    เพจที่เลือก: {selectedPageIds.map(id => pages.find(p => p.id === id)?.name).filter(Boolean).join(', ') || 'ไม่มี'}
                  </div>
                </div>
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
              <Label htmlFor="image-upload">อัปโหลดรูปภาพสินค้า (Image Asset)</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
              </div>
              {uploadedFilename && (
                <div className="text-xs text-green-700 flex flex-col gap-1 font-medium">
                  <span>อัปโหลดสำเร็จ: {uploadedFilename} (ID: {uploadedAssetId})</span>
                  <span className="font-mono text-[10px] text-green-800 break-all">public_image_url: {uploadedPublicImageUrl || 'ยังไม่พร้อม'}</span>
                </div>
              )}
              {uploadError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {uploadError}
                </div>
              )}
              {uploadedPublicImageUrl && (
                <div className="mt-2 max-w-[180px] overflow-hidden rounded-md border border-gray-200 shadow-sm bg-white p-1">
                  <img src={uploadedPublicImageUrl} alt="Uploaded asset preview" className="h-auto w-full rounded" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief">บรีฟ/รายละเอียดเพิ่มเติมสำหรับ AI (Brief Context)</Label>
              <Textarea
                id="brief"
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                rows={3}
                placeholder="ระบุจุดเด่น คีย์เวิร์ด หรือโปรโมชั่นพิเศษ เช่น แอร์น้ำหยดซ่อมด่วน, ระบบจัดคิวง่ายตอบไว ฯลฯ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caption">caption (Optional Custom Overwrite)</Label>
              <Textarea
                id="caption"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={4}
                placeholder="ใส่ caption สำหรับวิดีโอ"
              />
            </div>

            <Button
              onClick={handleGeneratePreview}
              disabled={submitting || selectedPageIds.length === 0 || !uploadedPublicImageUrl || uploadedImageUrls.length === 0}
              title={uploadedPublicImageUrl && uploadedImageUrls.length > 0 ? 'สร้าง preview พร้อม public image URL' : 'ต้องอัปโหลดรูปและได้ public image URL ก่อน'}
              className="w-full sm:w-auto"
            >
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
              Manual Publish Executor มีปุ่ม Publish to Facebook แต่จะ return blocked ถ้า flag/approval สำหรับ real publish ยังไม่เปิด
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Owner Review Queue</CardTitle>
            <p className="mt-1 text-xs text-gray-500">Local only: approved_for_future_publish → mock media ready → publish_plan_ready → publish_authorized_for_manual_execution → Publish to Facebook returns blocked when real flag is off</p>
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
            previewLogs.map((item) => {
              const brandPageMismatchMessage = getBrandPageMismatchMessage(item);
              const publishPlan = publishPlanPreviews[item.preview_id];
              const publishAuthorization = publishAuthorizations[item.preview_id];
              const publishExecutionDryRun = publishExecutionDryRuns[item.preview_id];
              const manualPublishExecution = manualPublishExecutions[item.preview_id];
              const facebookPageId = getFacebookPageId(item, publishPlan);

              return (
              <div key={item.preview_id} className="rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{item.selected_page_name}</div>
                    <div className="text-xs text-gray-500">{formatDate(item.created_at)} · {item.preview_id}</div>
                  </div>
                  <Badge variant="outline">{getStatusLabel(item.status)}</Badge>
                </div>

                {/* AI Generated Content Panel */}
                <div className="rounded-lg border border-gray-100 bg-gray-50/50 p-3.5 space-y-2.5">
                  <div className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                    AI Generated Copy & Brief Context
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-2">
                    <div>บรีฟลูกค้า: <span className="font-medium text-gray-800">{item.brief || '-'}</span></div>
                    <div>Asset ID: <span className="font-mono text-gray-600">{item.asset_id || item.uploaded_asset_id || '-'}</span></div>
                    <div className="sm:col-span-2">Public image: <span className="font-mono text-[10px] text-gray-600 break-all">{item.public_image_url || '-'}</span></div>
                    <div>หัวข้อวิดีโอ: <span className="font-medium text-gray-800">{item.video_title || '-'}</span></div>
                    <div>จุดฮุค (Hook): <span className="font-medium text-gray-800">{item.hook || '-'}</span></div>
                    <div className="sm:col-span-2">บทภาพ (Script): <span className="font-medium text-gray-800 block whitespace-pre-wrap mt-1 bg-white p-2 rounded border border-gray-200/50">{item.scene_script || '-'}</span></div>
                    <div className="sm:col-span-2">ข้อความซ้อนวิดีโอ (Overlays): <span className="font-medium text-gray-800">{item.overlay_texts || '-'}</span></div>
                    <div className="sm:col-span-2">แฮชแท็ก: <span className="font-medium text-gray-800 font-mono text-[10px]">{item.hashtags || '-'}</span></div>
                  </div>
                </div>

                <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
                  <div>brand_context: <span className="font-medium text-gray-900">{item.brand_context}</span></div>
                  <div>target_page_key: <span className="font-medium text-gray-900">{item.target_page_key}</span></div>
                  <div>platform: <span className="font-medium text-gray-900">{item.platform}</span></div>
                  <div>status: <span className="font-medium text-gray-900">{item.status}</span></div>
                  <div>n8n_status: <span className="font-medium text-gray-900">{item.n8n_status === null ? 'null' : item.n8n_status}</span></div>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-gray-700">Marketing Caption:</span>
                  <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700 border border-gray-150">{item.caption}</p>
                </div>

                {/* Render Job Section & Player */}
                <div className="border-t border-gray-100 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-700">Video Render Status:</span>
                    <Badge variant={item.public_media_url ? "default" : "secondary"}>
                      {item.render_status || (item.public_media_url ? "mock_render_ready" : "render_pending")}
                    </Badge>
                  </div>

                  {renderingPreviewId === item.preview_id ? (
                    <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3 text-xs flex items-center gap-2 text-blue-800 mb-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>กำลังเรนเดอร์วิดีโอสินค้า... สถานะ: {renderStatus}</span>
                    </div>
                  ) : null}

                  {item.public_media_url ? (
                    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-950 p-4 text-white flex flex-col items-center justify-center mb-2 shadow-inner">
                      <div className="flex items-center gap-2 mb-2">
                        <Clapperboard className="h-5 w-5 text-blue-500 animate-pulse" />
                        <span className="text-xs font-semibold text-gray-300">ตัวอย่างวิดีโอสินค้า (Preview Player)</span>
                      </div>
                      <video src={item.public_media_url} controls className="max-h-56 w-full rounded border border-gray-800" />
                      <div className="text-[10px] text-gray-400 font-mono mt-2 truncate w-full text-center">
                        URL: {item.public_media_url}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500 mb-2 bg-gray-50/30">
                      ยังไม่ได้เรนเดอร์วิดีโอสินค้า หรืออยู่ระหว่างเรนเดอร์
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleRenderRequest(item.preview_id)}
                      disabled={renderingPreviewId === item.preview_id || !item.public_image_url || !item.image_urls?.length}
                      title={item.public_image_url && item.image_urls?.length ? 'ส่งคำขอ render ด้วย public image URL' : 'ต้องมี public_image_url จากรูปที่อัปโหลดก่อน'}
                    >
                      {renderingPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                      Generate Video Preview
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
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

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
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
                    Set mock media ready (Fallback)
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

                {brandPageMismatchMessage ? (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
                    {brandPageMismatchMessage}
                  </div>
                ) : null}

                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/40 p-4 shadow-sm space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/70 pb-2">
                    <div>
                      <div className="text-sm font-semibold text-amber-950">Publish Gates for Current Preview Card</div>
                      <div className="text-[11px] text-amber-800">ทุก gate ด้านล่างผูกกับ preview_id นี้เท่านั้น: <span className="font-mono">{item.preview_id}</span></div>
                    </div>
                    <Badge variant="secondary">selected page: {item.selected_page_name || '-'}</Badge>
                  </div>

                {publishPlan ? (
                  <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Publish Plan Preview</div>
                      <Badge variant="secondary">publish_plan_ready</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div>target page: <span className="font-medium">{publishPlan.target_page.page_name}</span></div>
                      <div>platform: <span className="font-medium">{publishPlan.target_page.platform}</span></div>
                      <div>media: <span className="font-medium">{publishPlan.media.media_status}</span></div>
                      <div>media_type: <span className="font-medium">{publishPlan.media.media_type || '-'}</span></div>
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div className="sm:col-span-2">checksum: <span className="font-mono text-[11px]">{publishPlan.publish_plan_checksum}</span></div>
                    </div>

                    {/* Per-Page Publish Queue Preview */}
                    {item.selected_pages && (
                      <div className="space-y-2 border-t border-blue-200/50 pt-2">
                        <div className="text-xs font-semibold text-blue-900">Per-Page Publish Queue Preview:</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {JSON.parse(item.selected_pages).map((p: any) => (
                            <div key={p.page_id} className="rounded-lg border border-blue-200 bg-white p-2.5 text-xs flex flex-col gap-1 shadow-sm text-blue-950">
                              <div className="font-semibold text-blue-900">{p.page_name}</div>
                              <div className="text-gray-500 font-mono text-[10px]">ID: {p.page_id}</div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="h-2 w-2 rounded-full bg-yellow-500 animate-ping"></span>
                                <span className="text-yellow-700 font-medium">pending_authorization</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap rounded-lg bg-white/70 p-3 text-xs text-blue-950">
                      {publishPlan.content.caption}
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

                {publishAuthorization ? (
                  <div className="space-y-3 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">Final Publish Authorization Gate</div>
                        <div className="text-[11px] text-amber-800">Current preview card only · {item.preview_id}</div>
                      </div>
                      <Badge variant="secondary">publish_authorized_for_manual_execution</Badge>
                    </div>
                    {brandPageMismatchMessage ? (
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800">
                        {brandPageMismatchMessage}
                      </div>
                    ) : null}
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <ContextField label="preview_id" value={item.preview_id} mono />
                      <ContextField label="brand_context" value={item.brand_context || '-'} />
                      <ContextField label="selected_page_name" value={item.selected_page_name || '-'} />
                      <ContextField label="target_page_key" value={publishAuthorization.target_page_key || item.target_page_key || '-'} />
                      <ContextField label="facebook_page_id" value={facebookPageId} mono />
                      <ContextField label="idempotency_key" value={publishAuthorization.idempotency_key} mono />
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div>facebook_post_performed: <span className="font-medium">false</span></div>
                    </div>
                    <p className="text-xs">Audit-only authorization created. Real publish ยังต้องทำผ่าน manual executor gate และต้องเปิด flag/approval แยกเท่านั้น</p>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                      Warning: ปุ่ม Publish to Facebook ยังไม่โพสต์จริงถ้า real publish flag/approval แยกยังไม่เปิด ระบบจะบันทึก audit และ return blocked โดยไม่เรียก Facebook Graph
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handlePublishExecutionDryRun(item.preview_id)}
                      disabled={dryRunningExecutionPreviewId === item.preview_id}
                    >
                      {dryRunningExecutionPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Run guarded dry-run executor
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleManualPublishExecute(item)}
                      disabled={manualPublishingPreviewId === item.preview_id}
                      title="Manual executor gate: real publish ยังถูก block จนกว่า flag/approval แยกจะเปิด"
                    >
                      {manualPublishingPreviewId === item.preview_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Publish to Facebook
                    </Button>
                  </div>
                ) : null}

                {publishExecutionDryRun ? (
                  <div className="space-y-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Guarded Publish Executor Dry-run</div>
                      <Badge variant="secondary">{publishExecutionDryRun.status}</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <ContextField label="preview_id" value={item.preview_id} mono />
                      <ContextField label="selected_page_name" value={item.selected_page_name || '-'} />
                      <div>block_reason: <span className="font-medium">{publishExecutionDryRun.block_reason || 'none'}</span></div>
                      <div>safe_to_audit: <span className="font-medium">true</span></div>
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div>facebook_post_performed: <span className="font-medium">false</span></div>
                    </div>
                    <p className="text-xs">Dry-run เท่านั้น: ไม่เรียก Facebook, LINE, n8n, renderer, schedule, S3 หรือ mark posted</p>
                  </div>
                ) : null}

                {manualPublishExecution ? (
                  <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-semibold">Manual Publish Executor Gate</div>
                      <Badge variant="secondary">{manualPublishExecution.status}</Badge>
                    </div>
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <ContextField label="preview_id" value={item.preview_id} mono />
                      <ContextField label="selected_page_name" value={item.selected_page_name || '-'} />
                      <div>block_reason: <span className="font-medium">{manualPublishExecution.block_reason || 'none'}</span></div>
                      <div>real_posting_enabled: <span className="font-medium">false</span></div>
                      <div>publish_allowed: <span className="font-medium">false</span></div>
                      <div>facebook_post_performed: <span className="font-medium">false</span></div>
                    </div>
                    <p className="text-xs">ผลลัพธ์นี้ยืนยันว่า real publish ยังต้องเปิด flag/approve แยก และไม่มีการเรียก Facebook Graph</p>
                  </div>
                ) : null}
                </div>
              </div>
              );
            })
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
