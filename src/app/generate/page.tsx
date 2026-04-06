'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import { OutputDisplay } from '@/components/content/output-display';
import { Sparkles, Loader2, Save, RefreshCw, Building2, Image as ImageIcon, X, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Platform,
  ContentType,
  GenerationInput,
  ContentOutput,
  GeneratedContent,
  PLATFORMS,
  CONTENT_TYPES,
  TONES,
  POST_LENGTHS,
  CONTENT_GOALS,
  PLATFORM_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_GOAL_LABELS,
  PLATFORM_VARIANTS,
  ContentGoal,
  Tone,
  PostLength,
} from '@/types/database';
import {
  THAI_PLATFORM_LABELS,
  THAI_CONTENT_TYPE_LABELS,
  THAI_CONTENT_GOAL_LABELS,
  THAI_TONE_LABELS,
  THAI_LENGTH_LABELS,
  THAI_UI_LABELS,
} from '@/lib/constants/thai-labels';
import { defaultCTAPresets } from '@/lib/prompts/cta-presets';

interface SocialPage {
  id: string;
  name: string;
  provider: string;
  external_id: string;
}

const defaultInput: GenerationInput = {
  platform: 'facebook',
  platform_variant: 'post',
  content_type: 'promotion_post',
  tone: 'professional',
  language: 'th',
  post_length: 'medium',
};

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState<GenerationInput>(() => {
    const platform = searchParams.get('platform') as Platform || 'facebook';
    const contentType = searchParams.get('type') as ContentType || 'promotion_post';
    return { ...defaultInput, platform, content_type: contentType };
  });
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ content: GeneratedContent; output: ContentOutput } | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [socialPages, setSocialPages] = useState<SocialPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  useEffect(() => {
    loadProfile();
    loadSocialPages();
  }, []);

  async function loadSocialPages() {
    try {
      const res = await fetch('/api/social-pages');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSocialPages(data);
      }
    } catch (err) {
      console.error('Failed to load social pages', err);
    }
  }

  async function loadProfile() {
    try {
      const res = await fetch('/api/profiles');
      const profiles = await res.json();
      if (Array.isArray(profiles) && profiles.length > 0) {
        setProfileId(profiles[0].id);
        // Load campaigns
        const campRes = await fetch(`/api/campaigns?profile_id=${profiles[0].id}`);
        const camps = await campRes.json();
        if (Array.isArray(camps)) setCampaigns(camps);
      }
    } catch {
      // No profile
    } finally {
      setProfileLoading(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (imageFiles.length + files.length > 2) {
        toast.error('อัพโหลดได้สูงสุด 2 รูปภาพครับ');
        return;
      }

      const newFiles = [...imageFiles, ...files].slice(0, 2);
      setImageFiles(newFiles);

      Promise.all(
        newFiles.map((file) => {
          return new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
        })
      ).then((previews) => setImagePreviews(previews));
    }
  }

  function removeImage(index: number) {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);
    
    const newPreviews = [...imagePreviews];
    newPreviews.splice(index, 1);
    setImagePreviews(newPreviews);
  }

  async function handleGenerate() {
    if (!profileId) {
      toast.error('Please create a business profile first');
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      let image_analysis = '';
      let uploaded_image_url = '';

      if (imageFiles.length > 0) {
        setAnalyzingImage(true);
        try {
          const visionRes = await fetch('/api/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_urls: imagePreviews }),
          });
          if (visionRes.ok) {
            const visionData = await visionRes.json();
            image_analysis = visionData.analysis;
          }
        } catch (err) {
          console.error('Vision analysis failed', err);
        } finally {
          setAnalyzingImage(false);
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_profile_id: profileId,
          project_id: selectedCampaign || undefined,
          input: {
            ...input,
            image_analysis: image_analysis || undefined,
            image_urls: imagePreviews.length > 0 ? imagePreviews : undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      setResult({
        content: data.content,
        output: data.content.output_payload,
      });
      toast.success('Content generated successfully!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    try {
      await fetch(`/api/content/${result.content.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'saved' }),
      });
      toast.success('Content saved!');
    } catch {
      toast.error('Failed to save');
    }
  }

  function updateInput<K extends keyof GenerationInput>(key: K, value: GenerationInput[K]) {
    setInput((prev) => {
      const updated = { ...prev, [key]: value };
      if (key === 'platform') {
        updated.platform_variant = PLATFORM_VARIANTS[value as Platform]?.[0] || '';
      }
      return updated;
    });
  }

  if (profileLoading) return <LoadingSpinner text="Loading..." />;

  if (!profileId) {
    return (
      <div>
        <PageHeader title="สร้างคอนเทนต์" />
        <EmptyState
          icon={Building2}
          title="จำเป็นต้องสร้างโปรไฟล์ธุรกิจก่อน"
          description="กรุณาสร้างโปรไฟล์ธุรกิจของคุณก่อน เพื่อให้ AI สามารถปรับแต่งเนื้อหาให้เข้ากับธุรกิจของคุณได้"
          actionLabel="สร้างโปรไฟล์ธุรกิจ"
          onAction={() => (window.location.href = '/profile')}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="สร้างคอนเทนต์ด้วย AI"
        description="สร้างเนื้อหาการตลาดสำหรับแพลตฟอร์มต่าง ๆ โดยอิงจากข้อมูลธุรกิจของคุณ"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-4">
          <Card className="bg-white/80 backdrop-blur-lg border border-white/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-b border-white/50">
              <CardTitle className="text-base text-blue-800 font-medium">การตั้งค่าเนื้อหา</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              {/* Image Upload */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-gray-700 font-medium">{THAI_UI_LABELS.upload_image_title || 'อัพโหลดรูปภาพ (สูงสุด 2 รูป)'}</Label>
                  <span className="text-xs text-gray-400">{imageFiles.length}/2 รูป</span>
                </div>
                
                <div className="flex gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative rounded-xl overflow-hidden border border-gray-200 w-32 h-32 flex-shrink-0 group shadow-sm">
                      <img src={preview} alt={'Preview ' + (index + 1)} className="w-full h-full object-cover" />
                      <Button 
                        variant="destructive" 
                        size="icon" 
                        className="absolute top-1 right-1 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      {analyzingImage && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex flex-col items-center text-white">
                            <Loader2 className="h-6 w-6 animate-spin mb-1" />
                            <span className="text-[10px] font-medium">วิเคราะห์...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {imageFiles.length < 2 && (
                    <div 
                      className={`border-2 border-dashed border-gray-200 rounded-xl flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-50 hover:border-blue-400 transition-all cursor-pointer group flex-shrink-0 ${imageFiles.length === 0 ? 'w-full h-32 flex' : 'w-32 h-32 flex'}`}
                      onClick={() => document.getElementById('image-upload')?.click()}
                    >
                      <div className="rounded-full bg-blue-50 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform p-3">
                        <Upload className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="text-sm font-medium text-gray-600 text-center">เพิ่มรูปภาพ</span>
                      <input 
                        id="image-upload" 
                        type="file" 
                        accept="image/*" 
                        multiple
                        className="hidden" 
                        onChange={handleImageChange} 
                      />
                    </div>
                  )}
                </div>
              </div>
              {/* Social Page Selection (High Priority) */}
              <div>
                <Label className="text-indigo-600 font-semibold">เลือกเพจ / แผนผังโซเชียล</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-indigo-200 bg-indigo-50/30 px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500"
                  value={selectedPageId}
                  onChange={(e) => {
                    const pageId = e.target.value;
                    setSelectedPageId(pageId);
                    const page = socialPages.find(p => p.id === pageId);
                    if (page) {
                      updateInput('platform', page.provider as Platform);
                    }
                  }}
                >
                  <option value="">-- เลือกเพจที่ต้องการโพสต์ --</option>
                  {socialPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.provider.toUpperCase()}] {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Platform */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>แพลตฟอร์ม</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={input.platform}
                    onChange={(e) => updateInput('platform', e.target.value as Platform)}
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{THAI_PLATFORM_LABELS[p]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>รูปแบบโพสต์ (Variant)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={input.platform_variant || ''}
                    onChange={(e) => updateInput('platform_variant', e.target.value)}
                  >
                    {(PLATFORM_VARIANTS[input.platform] || []).map((v) => (
                      <option key={v} value={v}>{v.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Content Type */}
              <div>
                <Label>ประเภทเนื้อหา</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={input.content_type}
                  onChange={(e) => updateInput('content_type', e.target.value as ContentType)}
                >
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>{THAI_CONTENT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>

              {/* Content Goal */}
              <div>
                <Label>เป้าหมายของคอนเทนต์</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={input.content_goal || ''}
                  onChange={(e) => updateInput('content_goal', e.target.value)}
                >
                  <option value="">เลือกเป้าหมาย...</option>
                  {CONTENT_GOALS.map((g) => (
                    <option key={g} value={g}>{THAI_CONTENT_GOAL_LABELS[g as ContentGoal]}</option>
                  ))}
                </select>
              </div>

              {/* Tone & Length */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>น้ำเสียง/โทน (Tone)</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={input.tone}
                    onChange={(e) => updateInput('tone', e.target.value as Tone)}
                  >
                    {TONES.map((t) => (
                      <option key={t} value={t}>{THAI_TONE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>ความยาวโพสต์</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={input.post_length}
                    onChange={(e) => updateInput('post_length', e.target.value as PostLength)}
                  >
                    {POST_LENGTHS.map((l) => (
                      <option key={l} value={l}>{THAI_LENGTH_LABELS[l]}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Language */}
              <div>
                <Label>ภาษาที่ใช้</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={input.language}
                  onChange={(e) => updateInput('language', e.target.value)}
                >
                  <option value="th">ภาษาไทย (Thai)</option>
                  <option value="en">ภาษาอังกฤษ (English)</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{THAI_UI_LABELS.content_details}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>{THAI_UI_LABELS.service_type}</Label>
                <Input
                  value={input.service_type || ''}
                  onChange={(e) => updateInput('service_type', e.target.value)}
                  placeholder="เช่น ล้างแอร์, ซ่อมตู้เย็น"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.topic}</Label>
                <Input
                  value={input.topic || ''}
                  onChange={(e) => updateInput('topic', e.target.value)}
                  placeholder="เช่น เคล็ดลับการดูแลตู้แช่ในช่วงหน้าร้อน"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.pain_point}</Label>
                <Input
                  value={input.pain_point || ''}
                  onChange={(e) => updateInput('pain_point', e.target.value)}
                  placeholder="เช่น ตู้เย็นไม่เย็น, ค่าไฟแพง"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.location}</Label>
                <Input
                  value={input.location || ''}
                  onChange={(e) => updateInput('location', e.target.value)}
                  placeholder="เช่น กรุงเทพฯ, สมุทรปราการ, ย่านสยาม"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.promotion_offer}</Label>
                <Input
                  value={input.promotion_offer || ''}
                  onChange={(e) => updateInput('promotion_offer', e.target.value)}
                  placeholder="เช่น ส่วนลด 20% สำหรับลูกค้าใหม่, ตรวจเช็คฟรี"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.target_audience}</Label>
                <Input
                  value={input.target_audience || ''}
                  onChange={(e) => updateInput('target_audience', e.target.value)}
                  placeholder="เช่น เจ้าของร้านอาหาร, พ่อบ้านแม่บ้าน"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.cta_style}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={input.cta_style || ''}
                  onChange={(e) => updateInput('cta_style', e.target.value)}
                >
                  <option value="">{THAI_UI_LABELS.auto}</option>
                  {Object.entries(defaultCTAPresets).map(([key, preset]) => (
                    <option key={key} value={key}>{preset.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>{THAI_UI_LABELS.keyword}</Label>
                <Input
                  value={input.keyword || ''}
                  onChange={(e) => updateInput('keyword', e.target.value)}
                  placeholder="เช่น ล้างแอร์ กรุงเทพ"
                />
              </div>
              <div>
                <Label>{THAI_UI_LABELS.custom_notes}</Label>
                <Textarea
                  value={input.custom_notes || ''}
                  onChange={(e) => updateInput('custom_notes', e.target.value)}
                  placeholder="ระบุข้อมูลเพิ่มเติมหรือคำชี้แจงพิเศษ..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Campaign Assignment */}
          {campaigns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{THAI_UI_LABELS.assign_campaign}</CardTitle>
              </CardHeader>
              <CardContent>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={selectedCampaign}
                  onChange={(e) => setSelectedCampaign(e.target.value)}
                >
                  <option value="">{THAI_UI_LABELS.no_campaign}</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <Button
            className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                กำลังสร้างคอนเทนต์...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                สร้างคอนเทนต์เลย
              </>
            )}
          </Button>
        </div>

        {/* Output */}
        <div>
          {generating && (
            <Card className="bg-white/80 backdrop-blur-lg border border-white/40 shadow-xl rounded-2xl overflow-hidden">
              <CardContent className="py-24 animate-pulse">
                <LoadingSpinner text="AI กำลังร่างคอนเทนต์ พิมพ์แฮชแท็ก และจัดรูปแบบ SEO ให้คุณ..." />
              </CardContent>
            </Card>
          )}

          {result && !generating && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw className="h-3 w-3 mr-1" /> สร้างใหม่
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-3 w-3 mr-1" /> บันทึก
                </Button>
              </div>
              <OutputDisplay output={result.output} platform={input.platform} contentId={result.content?.id} imageUrls={imagePreviews} />
            </div>
          )}

          {!result && !generating && (
            <Card className="border-dashed border-2 bg-gradient-to-br from-blue-50/30 to-purple-50/30 border-blue-100 backdrop-blur-sm rounded-2xl shadow-inner">
              <CardContent className="py-20">
                <div className="text-center text-gray-400">
                  <div className="relative inline-flex items-center justify-center h-20 w-20 rounded-full bg-blue-100/50 mb-6 group-hover:scale-105 transition-transform shadow-sm">
                    <Sparkles className="h-10 w-10 text-blue-500 opacity-80" />
                    <div className="absolute inset-0 rounded-full border border-blue-200/50 animate-ping opacity-20"></div>
                  </div>
                  <p className="text-lg font-semibold text-gray-700">ระบุรายละเอียดและคลิก "สร้างคอนเทนต์เลย"</p>
                  <p className="text-sm mt-2 text-gray-500">AI จะประมวลผลตามหลัก SEO/AEO และสร้างคอนเทนต์เฉพาะธุรกิจคุณ</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeneratePage() {
  return (
    <Suspense fallback={<LoadingSpinner text="Loading..." />}>
      <GeneratePageInner />
    </Suspense>
  );
}
