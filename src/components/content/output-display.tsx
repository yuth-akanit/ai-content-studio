'use client';

import { ContentOutput, Platform } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, MessageCircle, Send, Loader2, Sparkles, Search } from 'lucide-react';
import { useState, useEffect } from 'react';
import { THAI_UI_LABELS, THAI_PLATFORM_LABELS } from '@/lib/constants/thai-labels';
import { toast } from 'sonner';

interface OutputDisplayProps {
  output: ContentOutput;
  platform: Platform;
  contentId?: string;
  imageUrls?: string[];
  videoUrl?: string;
}

interface SocialPage {
  id: string;
  name: string;
  provider: string;
  meta?: Record<string, any>;
}

type ErrorType = 'preflight' | 'storage' | 'meta_publish';

interface PublishErrorState {
  type: ErrorType;
  stage?: string;
  message: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 px-2">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </Button>
  );
}

function ContentBlock({ label, content, copyable = true }: { label: string; content?: string | null; copyable?: boolean }) {
  if (!content) return null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {copyable && <CopyButton text={content} />}
      </div>
      <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap">{content}</div>
    </div>
  );
}

export function OutputDisplay({ output, platform, contentId, imageUrls, videoUrl }: OutputDisplayProps) {
  const [socialPages, setSocialPages] = useState<SocialPage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [postProgress, setPostProgress] = useState(0);
  const [postStatusMessage, setPostStatusMessage] = useState('');
  const [publishError, setPublishError] = useState<PublishErrorState | null>(null);
  const [lastUploadPublicUrl, setLastUploadPublicUrl] = useState('');
  const [lastUploadSourceKey, setLastUploadSourceKey] = useState('');
  
  const [activeTab, setActiveTab] = useState('medium');
  const hashtagLine = output.hashtags && output.hashtags.length > 0 ? output.hashtags.join(' ') : '';

  // Strip headline from top, FAQ lines, and duplicate CTA after contact block
  function cleanPostText(text: string, headline?: string): string {
    let lines = text.split('\n');

    // 1. Strip headline/title from the top if the AI included it
    if (headline) {
      const h = headline.trim();
      let firstNonEmpty = 0;
      while (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === '') firstNonEmpty++;
      if (firstNonEmpty < lines.length) {
        const firstLine = lines[firstNonEmpty].trim();
        // Exact match or the first line contains the headline
        if (firstLine === h || firstLine.includes(h)) {
          lines.splice(firstNonEmpty, 1);
        }
      }
    }

    // 1b. Strip generic title-like first lines (e.g. "บริการซ่อมแอร์ด่วนจาก PAA Air Service")
    {
      let firstNonEmpty = 0;
      while (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === '') firstNonEmpty++;
      if (firstNonEmpty < lines.length) {
        const firstLine = lines[firstNonEmpty].trim();
        // Detect title-like patterns: starts with "บริการ" without emoji, or is a short non-emoji line
        const startsWithEmoji = /^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{2700}-\u{27BF}\u{E000}-\u{F8FF}\u{200D}\u{FE0F}\u{20E3}\u{2328}\u{23CF}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}✅❄️🔧📣⚡💨🏠❓⛔☀️🌡️]/u.test(firstLine);
        const looksLikeTitle = !startsWithEmoji && firstLine.length < 60 && !firstLine.includes('?') && !firstLine.includes('？');
        if (looksLikeTitle) {
          lines.splice(firstNonEmpty, 1);
        }
      }
    }

    // 2. Strip FAQ Q:/A: lines
    lines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('Q:') && !trimmed.startsWith('A:') && !trimmed.startsWith('Q：') && !trimmed.startsWith('A：');
    });

    // 3. Remove everything after contact block except blank lines and hashtags
    // Detect email line by multiple emoji variants (AI may use ✉️, 📫, 📧, 📩, etc.)
    const emailEmojis = ['✉️', '📫', '📧', '📩', '📬', '📪', '✉'];
    let emailLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (emailEmojis.some(e => trimmed.startsWith(e)) && (trimmed.includes('อีเมล') || trimmed.includes('email') || trimmed.includes('@'))) {
        emailLineIdx = i;
      }
    }
    if (emailLineIdx >= 0 && emailLineIdx < lines.length - 1) {
      const before = lines.slice(0, emailLineIdx + 1);
      const after = lines.slice(emailLineIdx + 1).filter(line => {
        const t = line.trim();
        return t === '' || t.startsWith('#');
      });
      lines = [...before, ...after];
    }

    return lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function buildPreviewText(): string {
    const platformVersion = output.platform_versions?.[platform as Platform] || output.platform_versions?.facebook;
    
    if (platformVersion) {
      const cleaned = cleanPostText(platformVersion, output.headline);
      // Only append hashtags if the cleaned text doesn't already contain them
      const alreadyHasHashtags = cleaned.split('\n').some(line => line.trim().startsWith('#'));
      return (hashtagLine && !alreadyHasHashtags) ? `${cleaned}\n\n${hashtagLine}` : cleaned;
    }
    if (output.caption_main) {
      const cleaned = cleanPostText(output.caption_main, output.headline);
      const alreadyHasHashtags = cleaned.split('\n').some(line => line.trim().startsWith('#'));
      return (hashtagLine && !alreadyHasHashtags) ? `${cleaned}\n\n${hashtagLine}` : cleaned;
    }
    const body = output.body ? cleanPostText(output.body, output.headline || output.title) : '';
    const alreadyHasHashtags = body.split('\n').some(line => line.trim().startsWith('#'));
    
    // We do NOT append output.cta here because AI always merges CTA into the body
    const parts = [
      output.title, // Only included if cleanPostText didn't strip it from body
      output.opening_hook,
      body,
      (hashtagLine && !alreadyHasHashtags) ? hashtagLine : null
    ].filter(Boolean);
    return parts.join('\n\n');
  }

  const [finalTextPreview, setFinalTextPreview] = useState(buildPreviewText);

  useEffect(() => {
    setFinalTextPreview(buildPreviewText());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output]);

  useEffect(() => {
    fetch('/api/social-pages')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSocialPages(data);
      })
      .catch(() => {});
  }, []);

  function togglePageSelection(pageId: string) {
    setSelectedPageIds(prev =>
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId],
    );
  }

  function mapErrorTypeLabel(type?: string): string {
    if (type === 'preflight') return 'Preflight Validation';
    if (type === 'storage') return 'Supabase Storage Upload';
    if (type === 'meta_publish') return 'Meta Publish';
    return 'Auto-post';
  }

  function mapStageLabel(stage?: string): string {
    if (stage === 'preflight_validation') return 'ตรวจสอบข้อมูลก่อนโพสต์';
    if (stage === 'supabase_storage_upload') return 'อัปโหลดวิดีโอเข้า Supabase';
    if (stage === 'meta_publish_facebook') return 'โพสต์ไป Facebook';
    if (stage === 'meta_publish_instagram') return 'โพสต์ไป Instagram';
    if (stage === 'meta_publish_line') return 'โพสต์ไป LINE OA';
    return 'กำลังดำเนินการ';
  }

  function setStructuredError(type: ErrorType, message: string, stage?: string) {
    setPublishError({ type, message, stage });
  }

  function getVideoSourceKey(source?: string): string {
    if (!source) return '';
    return source.slice(0, 120);
  }

  async function uploadVideoForPosting(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/auto-post/upload-video');
      xhr.setRequestHeader('Content-Type', 'application/json');

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const progress = Math.min(90, Math.round((event.loaded / event.total) * 85));
        setPostProgress(progress);
        setPostStatusMessage('กำลังส่งไฟล์วิดีโอขึ้นระบบสำหรับอัปโหลดไป Supabase...');
      };

      xhr.upload.onloadstart = () => {
        setPostProgress(5);
        setPostStatusMessage('เริ่มอัปโหลดวิดีโอ...');
      };

      xhr.upload.onload = () => {
        setPostProgress(90);
        setPostStatusMessage('ส่งไฟล์ถึงเซิร์ฟเวอร์แล้ว กำลังอัปโหลดวิดีโอเข้า Supabase...');
      };

      xhr.onerror = () => {
        reject({
          error_type: 'storage',
          error_stage: 'supabase_storage_upload',
          error: 'Network error while uploading video',
        });
      };

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || '{}');
          if (xhr.status >= 200 && xhr.status < 300 && data.success && data.public_url) {
            setPostProgress(95);
            setPostStatusMessage('อัปโหลดวิดีโอเข้า Supabase สำเร็จ กำลังเตรียม publish...');
            resolve(data.public_url as string);
            return;
          }

          reject(data);
        } catch {
          reject({
            error_type: 'storage',
            error_stage: 'supabase_storage_upload',
            error: 'Unexpected upload response',
          });
        }
      };

      xhr.send(JSON.stringify({ video_data_url: dataUrl }));
    });
  }

  async function runAutoPost(forceStorageRetry = false) {
    if (!contentId || selectedPageIds.length === 0) {
      toast.error(THAI_UI_LABELS.select_pages);
      return;
    }

    setPosting(true);
    setPostProgress(0);
    setPostStatusMessage(videoUrl ? 'เตรียมวิดีโอสำหรับโพสต์...' : 'เตรียมส่งโพสต์...');
    setPublishError(null);

    try {
      let resolvedVideoUrl = videoUrl;
      const currentVideoSourceKey = getVideoSourceKey(videoUrl);
      const canReuseLastUpload =
        !forceStorageRetry &&
        !!videoUrl?.startsWith('data:') &&
        !!lastUploadPublicUrl &&
        currentVideoSourceKey === lastUploadSourceKey;

      if (canReuseLastUpload) {
        resolvedVideoUrl = lastUploadPublicUrl;
        setPostProgress(95);
        setPostStatusMessage('ใช้วิดีโอที่อัปโหลดล่าสุดซ้ำ กำลังเตรียม publish...');
      } else if (videoUrl?.startsWith('data:')) {
        resolvedVideoUrl = await uploadVideoForPosting(videoUrl);
        setLastUploadPublicUrl(resolvedVideoUrl);
        setLastUploadSourceKey(currentVideoSourceKey);
      }

      setPostProgress(resolvedVideoUrl ? 96 : 35);
      setPostStatusMessage('กำลัง publish ไปยัง Meta และช่องทางที่เลือก...');

      const postPayload: Record<string, any> = {
        content_id: contentId,
        page_ids: selectedPageIds,
        message: finalTextPreview,
      };

      if (imageUrls && imageUrls.length > 0) {
        postPayload.image_urls = imageUrls;
      }

      if (resolvedVideoUrl) {
        postPayload.video_url = resolvedVideoUrl;
      }

      const res = await fetch('/api/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });

      const data = await res.json();
      if (data.success) {
        setPostProgress(100);
        setPostStatusMessage('โพสต์สำเร็จแล้ว');
        toast.success(`${THAI_UI_LABELS.post_success} (${data.posted}/${data.total})`);
      } else {
        const failedResult = data.results?.find((r: any) => !r.success);
        const errorType = (failedResult?.error_type || data.error_type || 'meta_publish') as ErrorType;
        const errorStage = failedResult?.error_stage || data.error_stage;
        const errorMsg = failedResult?.error || data.error || THAI_UI_LABELS.post_failed;
        setStructuredError(errorType, errorMsg, errorStage);
        setPostStatusMessage(`${mapErrorTypeLabel(errorType)} ล้มเหลว`);
        toast.error(`โพสต์ไม่สำเร็จ: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorType = (error?.error_type || 'storage') as ErrorType;
      const errorStage = error?.error_stage || 'supabase_storage_upload';
      const errorMessage = error?.error || THAI_UI_LABELS.post_failed;
      setStructuredError(errorType, errorMessage, errorStage);
      setPostStatusMessage(`${mapErrorTypeLabel(errorType)} ล้มเหลว`);
      toast.error(`โพสต์ไม่สำเร็จ: ${errorMessage}`);
    } finally {
      setPosting(false);
    }
  }

  async function handleAutoPost() {
    await runAutoPost(false);
  }

  async function handleRetryPost() {
    const shouldForceStorageRetry = publishError?.type === 'storage';
    await runAutoPost(shouldForceStorageRetry);
  }

  useEffect(() => {
    const nextSourceKey = getVideoSourceKey(videoUrl);
    if (!videoUrl?.startsWith('data:')) {
      setLastUploadPublicUrl(videoUrl || '');
      setLastUploadSourceKey(nextSourceKey);
      return;
    }

    if (nextSourceKey !== lastUploadSourceKey) {
      setLastUploadPublicUrl('');
      setLastUploadSourceKey(nextSourceKey);
    }
  }, [videoUrl, lastUploadSourceKey]);

  return (
    <div className="space-y-4">
      {/* Platform Multi-Pack View (New Strategy) */}
      {output.platform_versions && (
        <Card className="border-blue-200 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-700 py-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {THAI_UI_LABELS.platform_package}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="facebook" className="w-full">
              <TabsList className="bg-gray-100 w-full justify-start rounded-none h-12 px-2 border-b border-gray-200">
                {output.platform_versions.facebook && <TabsTrigger value="facebook" className="data-[state=active]:bg-white">{THAI_PLATFORM_LABELS.facebook}</TabsTrigger>}
                {output.platform_versions.line_oa && <TabsTrigger value="line_oa" className="data-[state=active]:bg-white">{THAI_PLATFORM_LABELS.line_oa}</TabsTrigger>}
                {output.platform_versions.instagram && <TabsTrigger value="instagram" className="data-[state=active]:bg-white">{THAI_PLATFORM_LABELS.instagram}</TabsTrigger>}
                {output.platform_versions.line_voom && <TabsTrigger value="line_voom" className="data-[state=active]:bg-white">{THAI_PLATFORM_LABELS.line_voom}</TabsTrigger>}
                {output.platform_versions.google_business && <TabsTrigger value="google_business" className="data-[state=active]:bg-white">{THAI_PLATFORM_LABELS.google_business}</TabsTrigger>}
                {output.platform_versions.tiktok && <TabsTrigger value="tiktok" className="data-[state=active]:bg-white">{THAI_PLATFORM_LABELS.tiktok}</TabsTrigger>}
              </TabsList>
              
              <div className="p-5">
                <TabsContent value="facebook" className="mt-0">
                  <div className="space-y-4">
                    <ContentBlock label={THAI_UI_LABELS.headline} content={output.headline} />
                    <ContentBlock label={THAI_UI_LABELS.content_body} content={output.platform_versions.facebook} />
                    {output.first_comment && (
                      <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                        <Label className="text-blue-700 mb-1 block">{THAI_UI_LABELS.first_comment}</Label>
                        <p className="text-sm whitespace-pre-wrap">{output.first_comment}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="line_oa" className="mt-0">
                  <div className="space-y-4">
                     <ContentBlock label={THAI_UI_LABELS.line_oa_version} content={output.platform_versions.line_oa} />
                  </div>
                </TabsContent>
                
                <TabsContent value="instagram" className="mt-0">
                  <div className="space-y-4">
                    <ContentBlock label={THAI_PLATFORM_LABELS.instagram} content={output.platform_versions.instagram} />
                    {output.hashtags && <div className="text-xs text-blue-600">{output.hashtags.join(' ')}</div>}
                  </div>
                </TabsContent>

                <TabsContent value="line_voom" className="mt-0">
                  <div className="space-y-4">
                    <ContentBlock label={THAI_UI_LABELS.line_voom_version} content={output.platform_versions.line_voom} />
                  </div>
                </TabsContent>

                <TabsContent value="google_business" className="mt-0">
                  <div className="space-y-4">
                    <ContentBlock label={THAI_UI_LABELS.google_business_version} content={output.platform_versions.google_business} />
                  </div>
                </TabsContent>
                
                <TabsContent value="tiktok" className="mt-0">
                  <div className="space-y-4">
                    <ContentBlock label={THAI_PLATFORM_LABELS.tiktok} content={output.platform_versions.tiktok} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Main Content Display (Legacy Compatibility) */}
      {!output.platform_versions && (
        <Card className="bg-white/80 backdrop-blur-lg border border-white/40 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-gray-100">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-600" />
              <span className="text-indigo-700">{THAI_UI_LABELS.auto_post}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ContentBlock label={THAI_UI_LABELS.title} content={output.title} />
            <ContentBlock label={THAI_UI_LABELS.opening_hook} content={output.opening_hook} />

            {(output.short_version || output.medium_version || output.long_version) ? (
              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{THAI_UI_LABELS.content_body}</span>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full">
                    {output.short_version && <TabsTrigger value="short" className="flex-1">{THAI_UI_LABELS.short}</TabsTrigger>}
                    {output.medium_version && <TabsTrigger value="medium" className="flex-1">{THAI_UI_LABELS.medium}</TabsTrigger>}
                    {output.long_version && <TabsTrigger value="long" className="flex-1">{THAI_UI_LABELS.long}</TabsTrigger>}
                  </TabsList>
                  {output.short_version && (
                    <TabsContent value="short">
                      <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap relative">
                        {output.short_version}
                        <div className="absolute top-1 right-1"><CopyButton text={output.short_version} /></div>
                      </div>
                    </TabsContent>
                  )}
                  {output.medium_version && (
                    <TabsContent value="medium">
                      <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap relative">
                        {output.medium_version}
                        <div className="absolute top-1 right-1"><CopyButton text={output.medium_version} /></div>
                      </div>
                    </TabsContent>
                  )}
                  {output.long_version && (
                    <TabsContent value="long">
                      <div className="p-3 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap relative">
                        {output.long_version}
                        <div className="absolute top-1 right-1"><CopyButton text={output.long_version} /></div>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            ) : (
              <ContentBlock label={THAI_UI_LABELS.body} content={output.body} />
            )}

            <ContentBlock label={THAI_UI_LABELS.cta} content={output.cta} />
            
            {output.hashtags && output.hashtags.length > 0 && (
              <ContentBlock label={THAI_UI_LABELS.hashtags || 'แฮชแท็ก (#Hashtags)'} content={output.hashtags.join(' ')} />
            )}
          </CardContent>
        </Card>
      )}

      {/* FAQ & SEO Section */}
      {(output.faq_section || output.faq || output.seo_keywords) && (
        <Card className="bg-white/80 border border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              SEO & FAQ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {output.seo_keywords && output.seo_keywords.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">{THAI_UI_LABELS.seo_keywords}</Label>
                <div className="flex flex-wrap gap-1">
                  {output.seo_keywords.map((k, i) => (
                    <span key={i} className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-600 border border-gray-200">{k}</span>
                  ))}
                </div>
              </div>
            )}
            
            {(output.faq_section || output.faq) && (
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">{THAI_UI_LABELS.faq_section}</Label>
                <div className="space-y-2">
                  {(output.faq_section || output.faq || []).map((faq, i) => (
                    <div key={i} className="bg-gray-50 p-3 rounded-lg text-sm border border-gray-100">
                      <p className="font-semibold text-gray-800">Q: {faq.question || (faq as any).q}</p>
                      <p className="text-gray-600 mt-1">A: {faq.answer || (faq as any).a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Auto-Post Panel */}
      {socialPages.length > 0 && contentId && (
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/30 to-purple-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4 text-indigo-600" />
              <span className="text-indigo-700">{THAI_UI_LABELS.auto_post}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">ตรวจสอบและแก้ไขข้อความโพสต์ฉบับสุดท้าย ก่อนแชร์จริง</span>
              <Textarea 
                value={finalTextPreview}
                onChange={(e) => setFinalTextPreview(e.target.value)}
                className="min-h-[250px] bg-white text-sm"
              />
            </div>

            {/* Preview the comment that will be posted automatically */}
            {(output.first_comment || (output.suggested_comments && output.suggested_comments.length > 0)) && (
              <div className="space-y-2 pt-2 border-t border-indigo-100">
                <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  คอมเมนต์ที่จะถูกโพสต์อัตโนมัติ
                </span>
                {output.first_comment && (
                  <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-sm">
                    <strong>1:</strong> {output.first_comment}
                  </div>
                )}
                {output.suggested_comments?.map((comment, index) => (
                  <div key={index} className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-sm text-gray-700">
                     <strong>{output.first_comment ? index + 2 : index + 1}:</strong> {comment}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs text-gray-500">{THAI_UI_LABELS.select_pages}</p>
              <div className="flex flex-wrap gap-2">
              {socialPages.map((page) => (
                <button
                  key={page.id}
                  onClick={() => togglePageSelection(page.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    selectedPageIds.includes(page.id)
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  [{page.meta?.is_instagram ? 'INSTAGRAM' : page.provider.toUpperCase()}] {page.name}
                </button>
              ))}
              </div>
            </div>

            {(posting || publishError || postProgress > 0) && (
              <div className={`rounded-xl border px-4 py-3 space-y-2 ${publishError ? 'border-red-200 bg-red-50' : 'border-indigo-100 bg-white/80'}`}>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className={publishError ? 'text-red-700' : 'text-indigo-700'}>
                    {publishError ? mapErrorTypeLabel(publishError.type) : 'Auto-post Progress'}
                  </span>
                  <span className={publishError ? 'text-red-600' : 'text-gray-500'}>{postProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full transition-all ${publishError ? 'bg-red-500' : 'bg-indigo-500'}`}
                    style={{ width: `${postProgress}%` }}
                  />
                </div>
                <p className={`text-sm ${publishError ? 'text-red-700' : 'text-gray-700'}`}>
                  {publishError ? publishError.message : postStatusMessage}
                </p>
                <p className={`text-[11px] ${publishError ? 'text-red-600' : 'text-gray-500'}`}>
                  {publishError ? mapStageLabel(publishError.stage) : postStatusMessage || 'กำลังเตรียมระบบ'}
                </p>
                {!posting && publishError && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleRetryPost}
                  >
                    <RefreshCw className="h-3 w-3 mr-2" />
                    ลองใหม่อีกครั้ง
                  </Button>
                )}
              </div>
            )}

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              onClick={handleAutoPost}
              disabled={posting || selectedPageIds.length === 0}
            >
              {posting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {THAI_UI_LABELS.posting_in_progress}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  {THAI_UI_LABELS.auto_post_btn} ({selectedPageIds.length})
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
