'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CalendarClock,
  Clapperboard,
  FileVideo,
  Loader2,
  Plus,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SHORT_FORM_FORMATS,
  SHORT_FORM_PLATFORM_TARGETS,
  ShortFormCampaignMetadata,
  ShortFormContentOutput,
  ShortFormFormat,
  ShortFormPlatformTarget,
} from '@/types/database';

interface ProfileOption {
  id: string;
  business_name: string;
}

interface ShortFormCampaignItem {
  id: string;
  name: string;
  status: string;
  metadata: ShortFormCampaignMetadata;
  generated_content_count: number;
  next_scheduled_at: string | null;
  created_at: string;
}

interface GeneratedShortFormItem {
  content: {
    id: string;
    output_payload: Record<string, unknown>;
  };
  output: ShortFormContentOutput;
}

const serviceOptions = [
  { value: 'ac_cleaning', label: 'ล้างแอร์' },
  { value: 'ac_repair', label: 'ซ่อมแอร์' },
  { value: 'ac_installation', label: 'ติดตั้งแอร์' },
  { value: 'ac_relocation', label: 'ย้ายแอร์' },
  { value: 'cold_room_refrigeration', label: 'ห้องเย็น / ตู้แช่ / ระบบทำความเย็น' },
];

const targetLabels: Record<ShortFormPlatformTarget, string> = {
  tiktok: 'TikTok',
  youtube_shorts: 'YouTube Shorts',
  instagram_reels: 'IG Reels',
  facebook_reels: 'FB Reels',
};

const formatLabels: Record<ShortFormFormat, string> = {
  '15s_short': '15-second short',
  '30s_short': '30-second short',
  '45s_educational_short': '45-second educational short',
  before_after_service_clip: 'Before/after service clip',
  problem_solution_clip: 'Problem-solution clip',
  technician_advice_clip: 'Technician advice clip',
  customer_faq_clip: 'Customer FAQ clip',
  promo_offer_clip: 'Promo/offer clip',
  myth_busting_clip: 'Myth-busting clip',
  checklist_clip: 'Checklist clip',
};

const defaultForm = {
  campaign_name: '',
  platform_targets: ['tiktok', 'youtube_shorts'] as ShortFormPlatformTarget[],
  primary_platform: 'tiktok' as ShortFormPlatformTarget,
  campaign_type: 'lead_gen',
  service_type: 'ac_cleaning',
  target_area: 'สมุทรปราการ, บางนา',
  content_angle: 'แอร์น้ำหยด / แอร์ไม่เย็น / ก่อนหลังล้างแอร์',
  cta_type: 'line_lead',
  cta_text: 'ทัก LINE @paairservice เพื่อประเมินอาการ/เช็กคิว',
  cta_url: '',
  utm_campaign: 'cleaning_samutprakan_may',
  posting_goal: 'lead',
  status: 'draft',
};

export default function ShortFormCampaignPage() {
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profileId, setProfileId] = useState('');
  const [campaigns, setCampaigns] = useState<ShortFormCampaignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingId, setGeneratingId] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<ShortFormCampaignItem | null>(null);
  const [generatedItems, setGeneratedItems] = useState<GeneratedShortFormItem[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [generationFormat, setGenerationFormat] = useState<ShortFormFormat>('30s_short');
  const [generationCount, setGenerationCount] = useState(5);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId),
    [profiles, profileId],
  );

  const loadCampaigns = useCallback(async (nextProfileId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/short-form-campaigns?profile_id=${nextProfileId}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to load campaigns');
      setCampaigns(data.items || []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'โหลดแคมเปญไม่สำเร็จ';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profiles');
        const data = await res.json();
        const items = Array.isArray(data) ? data : [];
        setProfiles(items);
        if (items[0]?.id) {
          setProfileId(items[0].id);
          await loadCampaigns(items[0].id);
        } else {
          setLoading(false);
        }
      } catch {
        setLoading(false);
        toast.error('โหลดโปรไฟล์ไม่สำเร็จ');
      }
    })();
  }, [loadCampaigns]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTarget(target: ShortFormPlatformTarget) {
    setForm((prev) => {
      const exists = prev.platform_targets.includes(target);
      const nextTargets = exists
        ? prev.platform_targets.filter((item) => item !== target)
        : [...prev.platform_targets, target];
      const safeTargets = nextTargets.length > 0 ? nextTargets : [target];
      const primary = safeTargets.includes(prev.primary_platform) ? prev.primary_platform : safeTargets[0];
      return { ...prev, platform_targets: safeTargets, primary_platform: primary };
    });
  }

  async function handleCreateCampaign() {
    if (!profileId) {
      toast.error('กรุณาสร้าง Business Profile ก่อน');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/short-form-campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          business_profile_id: profileId,
          cta_url: form.cta_url || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Create failed');
      toast.success('สร้าง short-form campaign แล้ว');
      setShowCreate(false);
      setForm(defaultForm);
      await loadCampaigns(profileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'สร้าง campaign ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(campaign: ShortFormCampaignItem) {
    setGeneratingId(campaign.id);
    setSelectedCampaign(campaign);
    setGeneratedItems([]);

    try {
      const res = await fetch('/api/short-form-campaigns/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          platform_targets: campaign.metadata.platform_targets,
          primary_platform: campaign.metadata.primary_platform,
          service_type: campaign.metadata.service_type,
          target_area: campaign.metadata.target_area,
          content_angle: campaign.metadata.content_angle,
          format: generationFormat,
          cta_text: campaign.metadata.cta_text,
          cta_type: campaign.metadata.cta_type,
          cta_url: campaign.metadata.cta_url || undefined,
          utm_campaign: campaign.metadata.utm_campaign,
          count: generationCount,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Generate failed');
      setGeneratedItems(data.items || []);
      toast.success(`สร้าง short-form content แล้ว ${data.items?.length || 0} ชิ้น`);
      if (profileId) await loadCampaigns(profileId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Generate ไม่สำเร็จ';
      toast.error(message);
    } finally {
      setGeneratingId('');
    }
  }

  if (loading) return <LoadingSpinner text="กำลังโหลด short-form campaigns..." />;

  if (!profileId) {
    return (
      <div>
        <PageHeader title="Short-form Campaigns" />
        <EmptyState
          icon={Clapperboard}
          title="ยังไม่มี Business Profile"
          description="สร้าง Business Profile ก่อนเริ่มทำ short-form campaign"
          actionLabel="ไปที่ Profile"
          onAction={() => (window.location.href = '/profile')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Short-form Campaigns"
        description={`TikTok / YouTube Shorts / Reels planning for ${selectedProfile?.business_name || 'PAA Air Service'}`}
        actions={
          <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Short-form Campaign
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Format</Label>
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={generationFormat}
              onChange={(event) => setGenerationFormat(event.target.value as ShortFormFormat)}
            >
              {SHORT_FORM_FORMATS.map((format) => (
                <option key={format} value={format}>{formatLabels[format]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Count</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={generationCount}
              onChange={(event) => setGenerationCount(Math.min(10, Math.max(1, Number(event.target.value) || 1)))}
              className="w-24"
            />
          </div>
          <Badge variant="outline" className="h-7">
            Prepared only - posting API not connected yet
          </Badge>
        </CardContent>
      </Card>

      {campaigns.length === 0 ? (
        <EmptyState
          icon={FileVideo}
          title="ยังไม่มี short-form campaign"
          description="เริ่มจาก campaign สำหรับบริการแอร์ แล้วค่อย generate script/caption"
          actionLabel="สร้าง campaign"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base text-blue-700">{campaign.name}</CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{campaign.metadata.content_angle}</p>
                  </div>
                  <Badge>{campaign.metadata.status}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">Primary: {targetLabels[campaign.metadata.primary_platform]}</Badge>
                  {campaign.metadata.platform_targets.map((target) => (
                    <Badge key={target} variant="secondary">{targetLabels[target]}</Badge>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Service</p>
                    <p className="font-medium">{campaign.metadata.service_type}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Target area</p>
                    <p className="font-medium">{campaign.metadata.target_area}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Generated</p>
                    <p className="font-medium">{campaign.generated_content_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Next scheduled</p>
                    <p className="font-medium">
                      {campaign.next_scheduled_at
                        ? new Date(campaign.next_scheduled_at).toLocaleString('th-TH')
                        : 'ยังไม่มี'}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  TikTok/YouTube Shorts: Prepared only — posting API not connected yet
                </div>

                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleGenerate(campaign)}
                  disabled={generatingId === campaign.id}
                >
                  {generatingId === campaign.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <WandSparkles className="h-4 w-4 mr-2" />
                  )}
                  Generate {generationCount} Scripts
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {generatedItems.length > 0 && selectedCampaign && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">
              Generated Content: {selectedCampaign.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {generatedItems.map((item) => (
              <div key={item.content.id} className="rounded-lg border border-gray-100 bg-white p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-gray-900">{item.output.hook}</h3>
                  <Badge variant="outline">{item.output.format}</Badge>
                </div>
                <pre className="whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-700 font-sans">
                  {item.output.script}
                </pre>
                <p className="text-sm text-gray-600">{item.output.caption_youtube_shorts}</p>
                <div className="flex flex-wrap gap-1">
                  {item.output.compliance_notes.map((note) => (
                    <Badge key={note} variant="secondary">{note}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Short-form Campaign</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1 md:col-span-2">
              <Label>Campaign name</Label>
              <Input value={form.campaign_name} onChange={(event) => updateForm('campaign_name', event.target.value)} />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Platform targets</Label>
              <div className="flex flex-wrap gap-2">
                {SHORT_FORM_PLATFORM_TARGETS.map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => toggleTarget(target)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      form.platform_targets.includes(target)
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-200 bg-white text-gray-600'
                    }`}
                  >
                    {targetLabels[target]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Primary platform</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.primary_platform}
                onChange={(event) => updateForm('primary_platform', event.target.value as ShortFormPlatformTarget)}
              >
                {form.platform_targets.map((target) => (
                  <option key={target} value={target}>{targetLabels[target]}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Service type</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.service_type}
                onChange={(event) => updateForm('service_type', event.target.value)}
              >
                {serviceOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Target area</Label>
              <Input value={form.target_area} onChange={(event) => updateForm('target_area', event.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>CTA type</Label>
              <Input value={form.cta_type} onChange={(event) => updateForm('cta_type', event.target.value)} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>Content angle</Label>
              <Textarea value={form.content_angle} onChange={(event) => updateForm('content_angle', event.target.value)} rows={3} />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label>CTA text</Label>
              <Input value={form.cta_text} onChange={(event) => updateForm('cta_text', event.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>CTA URL</Label>
              <Input value={form.cta_url} onChange={(event) => updateForm('cta_url', event.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>UTM campaign</Label>
              <Input value={form.utm_campaign} onChange={(event) => updateForm('utm_campaign', event.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Posting goal</Label>
              <Input value={form.posting_goal} onChange={(event) => updateForm('posting_goal', event.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
                <option value="archived">archived</option>
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <CalendarClock className="h-3 w-3 inline mr-1" />
            Scheduling uses generated content and currently supported social pages only. TikTok/YouTube posting is prepared for metadata, not connected.
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreateCampaign} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
