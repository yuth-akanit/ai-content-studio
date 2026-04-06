'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { TonePreset, CTAPreset, PlatformPreset, PromptPreset } from '@/types/database';
import { THAI_UI_LABELS } from '@/lib/constants/thai-labels';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [tab, setTab] = useState('tone');
  const [loading, setLoading] = useState(true);
  const [tonePresets, setTonePresets] = useState<TonePreset[]>([]);
  const [ctaPresets, setCTAPresets] = useState<CTAPreset[]>([]);
  const [platformPresets, setPlatformPresets] = useState<PlatformPreset[]>([]);
  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>([]);

  // Dialog state
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState<string>('tone');
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, c, p, pr] = await Promise.all([
        fetch('/api/presets?type=tone').then(r => r.json()),
        fetch('/api/presets?type=cta').then(r => r.json()),
        fetch('/api/presets?type=platform').then(r => r.json()),
        fetch('/api/presets?type=prompt').then(r => r.json()),
      ]);
      setTonePresets(Array.isArray(t) ? t : []);
      setCTAPresets(Array.isArray(c) ? c : []);
      setPlatformPresets(Array.isArray(p) ? p : []);
      setPromptPresets(Array.isArray(pr) ? pr : []);
    } catch {
      // ok
    } finally {
      setLoading(false);
    }
  }

  function openCreate(type: string) {
    setDialogType(type);
    setEditId(null);
    setFormData({});
    setShowDialog(true);
  }

  function openEdit(type: string, item: Record<string, unknown>) {
    setDialogType(type);
    setEditId(item.id as string);
    const fd: Record<string, string> = {};
    Object.entries(item).forEach(([k, v]) => {
      if (typeof v === 'string') fd[k] = v;
      else if (Array.isArray(v)) fd[k] = JSON.stringify(v);
      else if (typeof v === 'object' && v !== null) fd[k] = JSON.stringify(v);
      else if (typeof v === 'boolean') fd[k] = String(v);
    });
    setFormData(fd);
    setShowDialog(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { type: dialogType };

      if (dialogType === 'tone') {
        body.name = formData.name || '';
        body.description = formData.description || '';
        try { body.rules = JSON.parse(formData.rules || '[]'); } catch { body.rules = []; }
      } else if (dialogType === 'cta') {
        body.name = formData.name || '';
        body.cta_style = formData.cta_style || '';
        try { body.examples = JSON.parse(formData.examples || '[]'); } catch { body.examples = []; }
      } else if (dialogType === 'platform') {
        body.platform = formData.platform || '';
        body.variant = formData.variant || '';
        try { body.format_rules = JSON.parse(formData.format_rules || '{}'); } catch { body.format_rules = {}; }
      } else if (dialogType === 'prompt') {
        body.name = formData.name || '';
        body.platform = formData.platform || '';
        body.content_type = formData.content_type || '';
        body.system_prompt = formData.system_prompt || '';
        body.user_prompt_template = formData.user_prompt_template || '';
        body.is_default = formData.is_default === 'true';
      }

      if (editId) {
        body.id = editId;
        await fetch('/api/presets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success(THAI_UI_LABELS.preset_updated);
      } else {
        await fetch('/api/presets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        toast.success(THAI_UI_LABELS.preset_created);
      }

      setShowDialog(false);
      loadAll();
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_save_preset);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type: string, id: string) {
    try {
      await fetch(`/api/presets?type=${type}&id=${id}`, { method: 'DELETE' });
      toast.success(THAI_UI_LABELS.deleted_success);
      loadAll();
    } catch {
      toast.error(THAI_UI_LABELS.failed_to_delete_preset);
    }
  }

  if (loading) return <LoadingSpinner text={THAI_UI_LABELS.loading_settings} />;

  return (
    <div>
      <PageHeader title={THAI_UI_LABELS.settings} description={THAI_UI_LABELS.settings_desc} />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 bg-gray-100 p-1 rounded-xl">
          <TabsTrigger value="tone" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            {THAI_UI_LABELS.tone_presets}
          </TabsTrigger>
          <TabsTrigger value="cta" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            {THAI_UI_LABELS.cta_presets}
          </TabsTrigger>
          <TabsTrigger value="platform" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            {THAI_UI_LABELS.platform_presets}
          </TabsTrigger>
          <TabsTrigger value="prompt" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
            {THAI_UI_LABELS.prompt_presets}
          </TabsTrigger>
        </TabsList>

        {/* Tone Presets */}
        <TabsContent value="tone">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => openCreate('tone')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.add_tone_preset}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tonePresets.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{p.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{p.description}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit('tone', p as unknown as Record<string, unknown>)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500" onClick={() => handleDelete('tone', p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {p.rules && p.rules.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.rules.slice(0, 3).map((r, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{r}</Badge>
                      ))}
                      {p.rules.length > 3 && (
                        <Badge variant="secondary" className="text-[10px]">+{p.rules.length - 3}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {tonePresets.length === 0 && (
              <p className="text-sm text-gray-500 col-span-2 text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                {THAI_UI_LABELS.no_tone_presets}
              </p>
            )}
          </div>
        </TabsContent>

        {/* CTA Presets */}
        <TabsContent value="cta">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => openCreate('cta')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.add_cta_preset}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ctaPresets.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{p.name}</h3>
                      <Badge variant="outline" className="text-[10px] mt-1">{p.cta_style}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit('cta', p as unknown as Record<string, unknown>)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500" onClick={() => handleDelete('cta', p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {p.examples && p.examples.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {p.examples.slice(0, 2).map((e, i) => (
                        <p key={i} className="text-xs text-gray-600">"{e}"</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {ctaPresets.length === 0 && (
              <p className="text-sm text-gray-500 col-span-2 text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                {THAI_UI_LABELS.no_cta_presets}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Platform Presets */}
        <TabsContent value="platform">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => openCreate('platform')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.add_platform_preset}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {platformPresets.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{p.platform}</h3>
                      {p.variant && <Badge variant="outline" className="text-[10px] mt-1">{p.variant}</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit('platform', p as unknown as Record<string, unknown>)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500" onClick={() => handleDelete('platform', p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {platformPresets.length === 0 && (
              <p className="text-sm text-gray-500 col-span-2 text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                {THAI_UI_LABELS.no_platform_presets}
              </p>
            )}
          </div>
        </TabsContent>

        {/* Prompt Presets */}
        <TabsContent value="prompt">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => openCreate('prompt')} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.add_prompt_preset}
            </Button>
          </div>
          <div className="space-y-3">
            {promptPresets.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">{p.name}</h3>
                        {p.is_default && <Badge className="bg-blue-100 text-blue-700 text-[10px]">{THAI_UI_LABELS.default_badge}</Badge>}
                      </div>
                      <div className="flex gap-1 mt-1">
                        {p.platform && <Badge variant="outline" className="text-[10px]">{p.platform}</Badge>}
                        {p.content_type && <Badge variant="outline" className="text-[10px]">{p.content_type}</Badge>}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.system_prompt}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit('prompt', p as unknown as Record<string, unknown>)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500" onClick={() => handleDelete('prompt', p.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {promptPresets.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                {THAI_UI_LABELS.no_prompt_presets}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-blue-700">
              {editId ? THAI_UI_LABELS.edit_preset : THAI_UI_LABELS.new_preset} ({dialogType.charAt(0).toUpperCase() + dialogType.slice(1)})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dialogType === 'tone' && (
              <>
                <div>
                  <Label>Name</Label>
                  <Input value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={formData.description || ''} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div>
                  <Label>Rules (JSON array)</Label>
                  <Textarea value={formData.rules || '[]'} onChange={(e) => setFormData(p => ({ ...p, rules: e.target.value }))} rows={4} className="font-mono text-xs" />
                </div>
              </>
            )}
            {dialogType === 'cta' && (
              <>
                <div>
                  <Label>Name</Label>
                  <Input value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <Label>CTA Style</Label>
                  <Input value={formData.cta_style || ''} onChange={(e) => setFormData(p => ({ ...p, cta_style: e.target.value }))} />
                </div>
                <div>
                  <Label>Examples (JSON array)</Label>
                  <Textarea value={formData.examples || '[]'} onChange={(e) => setFormData(p => ({ ...p, examples: e.target.value }))} rows={4} className="font-mono text-xs" />
                </div>
              </>
            )}
            {dialogType === 'platform' && (
              <>
                <div>
                  <Label>Platform</Label>
                  <Input value={formData.platform || ''} onChange={(e) => setFormData(p => ({ ...p, platform: e.target.value }))} />
                </div>
                <div>
                  <Label>Variant</Label>
                  <Input value={formData.variant || ''} onChange={(e) => setFormData(p => ({ ...p, variant: e.target.value }))} />
                </div>
                <div>
                  <Label>Format Rules (JSON)</Label>
                  <Textarea value={formData.format_rules || '{}'} onChange={(e) => setFormData(p => ({ ...p, format_rules: e.target.value }))} rows={4} className="font-mono text-xs" />
                </div>
              </>
            )}
            {dialogType === 'prompt' && (
              <>
                <div>
                  <Label>Name</Label>
                  <Input value={formData.name || ''} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Platform</Label>
                    <Input value={formData.platform || ''} onChange={(e) => setFormData(p => ({ ...p, platform: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Content Type</Label>
                    <Input value={formData.content_type || ''} onChange={(e) => setFormData(p => ({ ...p, content_type: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>System Prompt</Label>
                  <Textarea value={formData.system_prompt || ''} onChange={(e) => setFormData(p => ({ ...p, system_prompt: e.target.value }))} rows={4} className="font-mono text-xs" />
                </div>
                <div>
                  <Label>User Prompt Template</Label>
                  <Textarea value={formData.user_prompt_template || ''} onChange={(e) => setFormData(p => ({ ...p, user_prompt_template: e.target.value }))} rows={4} className="font-mono text-xs" />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              {THAI_UI_LABELS.cancel_btn}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? THAI_UI_LABELS.saving_btn : THAI_UI_LABELS.save_btn}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
