'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { BusinessProfile, BUSINESS_TYPES, TONES } from '@/types/database';
import { THAI_UI_LABELS, THAI_TONE_LABELS } from '@/lib/constants/thai-labels';

type FormData = Omit<BusinessProfile, 'id' | 'created_at' | 'updated_at'>;

const defaultForm: FormData = {
  business_name: '',
  business_type: 'general_service',
  description: '',
  tone_of_voice: 'professional',
  brand_style: 'clean',
  service_categories: [],
  service_areas: [],
  target_audience: [],
  pain_points: [],
  faq_knowledge: [],
  review_examples: [],
  trust_signals: [],
  promotion_goals: [],
  brand_keywords: [],
  banned_words: [],
  contact_phone: '',
  contact_line: '',
  contact_email: '',
  website_url: '',
  social_links: {},
  default_ctas: [],
  default_language: 'th',
  bilingual_enabled: false,
};

function TagInput({ values, onChange, placeholder }: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState('');

  function addTag() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput('');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map((v, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, j) => j !== i))} className="hover:text-blue-900">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
          placeholder={placeholder}
          className="text-sm"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTag}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const [form, setForm] = useState<FormData>(defaultForm);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await fetch('/api/profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        const p = profiles[0];
        setProfileId(p.id);
        setForm({
          business_name: p.business_name || '',
          business_type: p.business_type || 'general_service',
          description: p.description || '',
          tone_of_voice: p.tone_of_voice || 'professional',
          brand_style: p.brand_style || 'clean',
          service_categories: p.service_categories || [],
          service_areas: p.service_areas || [],
          target_audience: p.target_audience || [],
          pain_points: p.pain_points || [],
          faq_knowledge: p.faq_knowledge || [],
          review_examples: p.review_examples || [],
          trust_signals: p.trust_signals || [],
          promotion_goals: p.promotion_goals || [],
          brand_keywords: p.brand_keywords || [],
          banned_words: p.banned_words || [],
          contact_phone: p.contact_phone || '',
          contact_line: p.contact_line || '',
          contact_email: p.contact_email || '',
          website_url: p.website_url || '',
          social_links: p.social_links || {},
          default_ctas: p.default_ctas || [],
          default_language: p.default_language || 'th',
          bilingual_enabled: p.bilingual_enabled || false,
        });
      }
    } catch {
      // New profile
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.business_name.trim()) {
      toast.error('กรุณาระบุชื่อธุรกิจ');
      return;
    }
    setSaving(true);
    try {
      const url = profileId ? `/api/profiles/${profileId}` : '/api/profiles';
      const method = profileId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('บันทึกไม่สำเร็จ');
      const saved = await res.json();
      setProfileId(saved.id);
      toast.success('บันทึกข้อมูลธุรกิจเรียบร้อยแล้ว!');
    } catch {
      toast.error('การบันทึกโปรไฟล์ขัดข้อง');
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  if (loading) return <LoadingSpinner text={THAI_UI_LABELS.loading_profile} />;

  return (
    <div>
      <PageHeader
        title={THAI_UI_LABELS.business_profile}
        description={THAI_UI_LABELS.business_profile_desc}
        actions={
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4 mr-2" />
            {saving ? THAI_UI_LABELS.saving : THAI_UI_LABELS.save_profile}
          </Button>
        }
      />

      <div className="space-y-6 max-w-4xl">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.basic_info}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{THAI_UI_LABELS.business_name_label}</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => updateField('business_name', e.target.value)}
                  placeholder="เช่น บางพลี-เครื่องเย็น"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.business_type_label}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.business_type}
                  onChange={(e) => updateField('business_type', e.target.value)}
                >
                  {BUSINESS_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <Label>{THAI_UI_LABELS.company_description}</Label>
              <Textarea
                value={form.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder={THAI_UI_LABELS.company_desc_placeholder}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Services */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.services_coverage}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{THAI_UI_LABELS.service_categories_label}</Label>
              <TagInput
                values={form.service_categories}
                onChange={(v) => updateField('service_categories', v)}
                placeholder="เช่น ล้างแอร์, ติดตั้งแอร์, ซ่อมตู้แช่"
              />
            </div>
            <div>
              <Label>{THAI_UI_LABELS.service_areas_label}</Label>
              <TagInput
                values={form.service_areas}
                onChange={(v) => updateField('service_areas', v)}
                placeholder="เช่น กรุงเทพฯ, สมุทรปราการ, ย่านสยาม"
              />
            </div>
          </CardContent>
        </Card>

        {/* Brand & Tone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.brand_tone}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{THAI_UI_LABELS.tone_voice_label}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.tone_of_voice}
                  onChange={(e) => updateField('tone_of_voice', e.target.value)}
                >
                  {TONES.map((t) => (
                    <option key={t} value={t}>{THAI_TONE_LABELS[t] || t}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{THAI_UI_LABELS.brand_style_label}</Label>
                <Input
                  value={form.brand_style}
                  onChange={(e) => updateField('brand_style', e.target.value)}
                  placeholder="เช่น สะอาด, ทันสมัย, น่าเชื่อถือ"
                />
              </div>
            </div>
            <div>
              <Label>{THAI_UI_LABELS.brand_keywords_label}</Label>
              <TagInput
                values={form.brand_keywords}
                onChange={(v) => updateField('brand_keywords', v)}
                placeholder="คำที่ต้องการให้เน้นในคอนเทนต์"
              />
            </div>
            <div>
              <Label>{THAI_UI_LABELS.banned_words_label}</Label>
              <TagInput
                values={form.banned_words}
                onChange={(v) => updateField('banned_words', v)}
                placeholder="คำที่ห้ามนำมาใช้เด็ดขาด"
              />
            </div>
          </CardContent>
        </Card>

        {/* Target & Pain Points */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.target_pain_points}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{THAI_UI_LABELS.target_audience}</Label>
              <TagInput
                values={form.target_audience}
                onChange={(v) => updateField('target_audience', v)}
                placeholder="เช่น เจ้าของบ้าน, ผู้จัดการคอนโด, เจ้าของร้านอาหาร"
              />
            </div>
            <div>
              <Label>{THAI_UI_LABELS.common_pain_points}</Label>
              <TagInput
                values={form.pain_points}
                onChange={(v) => updateField('pain_points', v)}
                placeholder="เช่น แอร์ไม่เย็น, ค่าไฟพุ่ง, ติดต่อยาก"
              />
            </div>
          </CardContent>
        </Card>

        {/* Trust & CTAs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.trust_ctas}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{THAI_UI_LABELS.trust_signals_label}</Label>
              <TagInput
                values={form.trust_signals}
                onChange={(v) => updateField('trust_signals', v)}
                placeholder="เช่น ประสบการณ์ 10 ปี, มีใบอนุญาต, รีวิว 5 ดาว"
              />
            </div>
            <div>
              <Label>{THAI_UI_LABELS.promotion_goals_label}</Label>
              <TagInput
                values={form.promotion_goals}
                onChange={(v) => updateField('promotion_goals', v)}
                placeholder="เช่น เพิ่มยอดจอง, สร้างการจดจำแบรนด์"
              />
            </div>
            <div>
              <Label>{THAI_UI_LABELS.default_ctas_label}</Label>
              <TagInput
                values={form.default_ctas}
                onChange={(v) => updateField('default_ctas', v)}
                placeholder="เช่น โทรเลย, แอดไลน์เพื่อสอบถาม, จองออนไลน์"
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.contact_info}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{THAI_UI_LABELS.phone_label}</Label>
                <Input
                  value={form.contact_phone || ''}
                  onChange={(e) => updateField('contact_phone', e.target.value)}
                  placeholder="เช่น 02-xxx-xxxx"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.line_id_label}</Label>
                <Input
                  value={form.contact_line || ''}
                  onChange={(e) => updateField('contact_line', e.target.value)}
                  placeholder="เช่น @paaairservice"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.email_label}</Label>
                <Input
                  value={form.contact_email || ''}
                  onChange={(e) => updateField('contact_email', e.target.value)}
                  placeholder="เช่น admin@paaair.com"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.website_url_label}</Label>
                <Input
                  value={form.website_url || ''}
                  onChange={(e) => updateField('website_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{THAI_UI_LABELS.facebook_url_label}</Label>
                <Input
                  value={form.social_links?.facebook || ''}
                  onChange={(e) => updateField('social_links', { ...form.social_links, facebook: e.target.value })}
                  placeholder="https://facebook.com/..."
                />
              </div>
              <div>
                <Label>Instagram</Label>
                <Input
                  value={form.social_links?.instagram || ''}
                  onChange={(e) => updateField('social_links', { ...form.social_links, instagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div>
                <Label>TikTok</Label>
                <Input
                  value={form.social_links?.tiktok || ''}
                  onChange={(e) => updateField('social_links', { ...form.social_links, tiktok: e.target.value })}
                  placeholder="https://tiktok.com/@..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.language_settings}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{THAI_UI_LABELS.default_lang_label}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={form.default_language}
                  onChange={(e) => updateField('default_language', e.target.value)}
                >
                  <option value="th">ไทย (Thai)</option>
                  <option value="en">English (English)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.bilingual_enabled}
                  onCheckedChange={(v) => updateField('bilingual_enabled', v)}
                />
                <Label>{THAI_UI_LABELS.bilingual_mode}</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Knowledge */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-blue-700">{THAI_UI_LABELS.faq_base}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateField('faq_knowledge', [...form.faq_knowledge, { question: '', answer: '' }])
              }
              className="text-blue-600 border-blue-200"
            >
              <Plus className="h-3 w-3 mr-1" /> {THAI_UI_LABELS.add_faq}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.faq_knowledge.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                ยังไม่มีข้อมูล FAQ เพิ่มคำถามที่พบบ่อยเพื่อช่วยให้ AI สร้างเนื้อหาได้แม่นยำขึ้น
              </p>
            )}
            {form.faq_knowledge.map((faq, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg space-y-2">
                <div className="flex items-start justify-between">
                  <Label className="text-xs text-gray-500">FAQ #{i + 1}</Label>
                  <button
                    type="button"
                    onClick={() =>
                      updateField('faq_knowledge', form.faq_knowledge.filter((_, j) => j !== i))
                    }
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Input
                  value={faq.question}
                  onChange={(e) => {
                    const updated = [...form.faq_knowledge];
                    updated[i] = { ...updated[i], question: e.target.value };
                    updateField('faq_knowledge', updated);
                  }}
                  placeholder="Question"
                  className="text-sm"
                />
                <Textarea
                  value={faq.answer}
                  onChange={(e) => {
                    const updated = [...form.faq_knowledge];
                    updated[i] = { ...updated[i], answer: e.target.value };
                    updateField('faq_knowledge', updated);
                  }}
                  placeholder="Answer"
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Save button at bottom */}
        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 min-w-[200px]">
            <Save className="h-4 w-4 mr-2" />
            {saving ? THAI_UI_LABELS.saving : THAI_UI_LABELS.save_profile}
          </Button>
        </div>
      </div>
    </div>
  );
}
