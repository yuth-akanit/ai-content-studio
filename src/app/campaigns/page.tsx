'use client';

import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/shared/platform-badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FolderKanban,
  Plus,
  Edit,
  Trash2,
  FileText,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ContentProject,
  GeneratedContent,
  CAMPAIGN_TYPES,
  CONTENT_TYPE_LABELS,
  ContentType,
  Platform,
} from '@/types/database';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  archived: 'bg-gray-100 text-gray-700',
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<ContentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editCampaign, setEditCampaign] = useState<ContentProject | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [campaignContents, setCampaignContents] = useState<Record<string, GeneratedContent[]>>({});

  // Form state
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState('general');
  const [saving, setSaving] = useState(false);

  const loadCampaigns = useCallback(async (pid: string) => {
    try {
      const res = await fetch(`/api/campaigns?profile_id=${pid}`);
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        setProfileId(profiles[0].id);
      } else {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (profileId) loadCampaigns(profileId);
  }, [profileId, loadCampaigns]);

  async function loadCampaignContents(campaignId: string) {
    if (campaignContents[campaignId]) return;
    try {
      const res = await fetch(`/api/content?profile_id=${profileId}&project_id=${campaignId}&limit=50`);
      const data = await res.json();
      setCampaignContents(prev => ({ ...prev, [campaignId]: data.data || [] }));
    } catch {
      // fail silently
    }
  }

  function openCreate() {
    setFormName('');
    setFormDesc('');
    setFormType('general');
    setEditCampaign(null);
    setShowCreate(true);
  }

  function openEdit(campaign: ContentProject) {
    setFormName(campaign.name);
    setFormDesc(campaign.description || '');
    setFormType(campaign.campaign_type);
    setEditCampaign(campaign);
    setShowCreate(true);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast.error(THAI_UI_LABELS.campaign_name_required);
      return;
    }
    setSaving(true);
    try {
      if (editCampaign) {
        await fetch(`/api/campaigns/${editCampaign.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, description: formDesc, campaign_type: formType }),
        });
        toast.success(THAI_UI_LABELS.campaign_updated);
      } else {
        await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            business_profile_id: profileId,
            name: formName,
            description: formDesc,
            campaign_type: formType,
          }),
        });
        toast.success(THAI_UI_LABELS.campaign_created);
      }
      setShowCreate(false);
      if (profileId) loadCampaigns(profileId);
    } catch {
      toast.error('Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
      toast.success(THAI_UI_LABELS.campaign_deleted);
      if (profileId) loadCampaigns(profileId);
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_delete);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (profileId) loadCampaigns(profileId);
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_update_status);
    }
  }

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadCampaignContents(id);
    }
  }

  if (loading) return <LoadingSpinner text={THAI_UI_LABELS.loading_campaigns} />;

  if (!profileId) {
    return (
      <div>
        <PageHeader title={THAI_UI_LABELS.campaign_workspace} />
        <EmptyState
          icon={FolderKanban}
          title={THAI_UI_LABELS.no_data_yet}
          description={THAI_UI_LABELS.start_generating_desc}
          actionLabel={THAI_UI_LABELS.create_profile_btn}
          onAction={() => (window.location.href = '/profile')}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={THAI_UI_LABELS.campaign_workspace}
        description={THAI_UI_LABELS.campaign_desc}
        actions={
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" /> {THAI_UI_LABELS.new_campaign}
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={THAI_UI_LABELS.no_campaigns}
          description={THAI_UI_LABELS.create_first_campaign}
          actionLabel={THAI_UI_LABELS.create_campaign_btn}
          onAction={openCreate}
        />
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => toggleExpand(campaign.id)}>
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${expandedId === campaign.id ? 'rotate-90' : ''}`} />
                    <div>
                      <CardTitle className="text-base">{campaign.name}</CardTitle>
                      {campaign.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{campaign.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_COLORS[campaign.status]}>
                      {campaign.status === 'active' ? THAI_UI_LABELS.status_active :
                       campaign.status === 'paused' ? THAI_UI_LABELS.status_paused :
                       campaign.status === 'completed' ? THAI_UI_LABELS.status_completed :
                       THAI_UI_LABELS.status_archived}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {campaign.campaign_type.replace(/_/g, ' ')}
                    </Badge>
                    <select
                      className="h-7 text-xs rounded border border-input bg-transparent px-1"
                      value={campaign.status}
                      onChange={(e) => handleStatusChange(campaign.id, e.target.value)}
                    >
                      <option value="active">{THAI_UI_LABELS.status_active}</option>
                      <option value="paused">{THAI_UI_LABELS.status_paused}</option>
                      <option value="completed">{THAI_UI_LABELS.status_completed}</option>
                      <option value="archived">{THAI_UI_LABELS.status_archived}</option>
                    </select>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(campaign)}>
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500" onClick={() => handleDelete(campaign.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {expandedId === campaign.id && (
                <CardContent className="pt-0">
                  <div className="border-t border-gray-100 pt-3 mt-1">
                    {!campaignContents[campaign.id] ? (
                      <LoadingSpinner className="py-4" />
                    ) : campaignContents[campaign.id].length === 0 ? (
                      <div className="text-center py-6">
                        <FileText className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                        <p className="text-sm text-gray-500">{THAI_UI_LABELS.no_content_in_campaign}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => (window.location.href = `/generate?campaign=${campaign.id}`)}
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.generate_for_campaign}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {campaignContents[campaign.id].map((content) => (
                          <div key={content.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div className="flex items-center gap-2">
                              <PlatformBadge platform={content.platform as Platform} />
                              <span className="text-sm">
                                {content.output_payload?.title || CONTENT_TYPE_LABELS[content.content_type as ContentType]}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {new Date(content.created_at).toLocaleDateString('th-TH')}
                            </span>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs font-medium"
                          onClick={() => (window.location.href = `/generate?campaign=${campaign.id}`)}
                        >
                          <Sparkles className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.generate_more_content}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-blue-700">
              {editCampaign ? THAI_UI_LABELS.edit_campaign : THAI_UI_LABELS.new_campaign}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">{THAI_UI_LABELS.campaign_name_label}</Label>
              <Input
                className="mt-1"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="เช่น แคมเปญหน้าร้อน 2567"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">{THAI_UI_LABELS.campaign_desc_label}</Label>
              <Textarea
                className="mt-1"
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                placeholder="แคมเปญนี้เกี่ยวกับอะไร?"
                rows={3}
              />
            </div>
            <div>
              <Label className="text-sm font-medium">{THAI_UI_LABELS.campaign_type_label}</Label>
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors"
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
              >
                {CAMPAIGN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              {THAI_UI_LABELS.cancel_btn}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? THAI_UI_LABELS.saving_btn : editCampaign ? THAI_UI_LABELS.update_btn : THAI_UI_LABELS.create_btn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
