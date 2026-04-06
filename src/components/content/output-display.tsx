'use client';

import { ContentOutput, Platform, PLATFORM_LABELS } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
}

interface SocialPage {
  id: string;
  name: string;
  provider: string;
  meta?: Record<string, any>;
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

export function OutputDisplay({ output, platform, contentId, imageUrls }: OutputDisplayProps) {
  const [socialPages, setSocialPages] = useState<SocialPage[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  
  const [activeTab, setActiveTab] = useState('medium');
  const hashtagLine = output.hashtags && output.hashtags.length > 0 ? output.hashtags.join(' ') : '';

  // Strip headline from top, FAQ lines, and duplicate CTA after contact block
  function cleanPostText(text: string, headline?: string): string {
    let lines = text.split('\n');

    // 1. Strip headline from the top if the AI included it
    if (headline) {
      const h = headline.trim();
      let firstNonEmpty = 0;
      while (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === '') firstNonEmpty++;
      if (firstNonEmpty < lines.length && lines[firstNonEmpty].trim() === h) {
        lines.splice(firstNonEmpty, 1);
      }
    }

    // 2. Strip FAQ Q:/A: lines
    lines = lines.filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('Q:') && !trimmed.startsWith('A:') && !trimmed.startsWith('Q：') && !trimmed.startsWith('A：');
    });

    // 3. Remove duplicate CTA after contact block (after ✉️ email line)
    let emailLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('✉️')) {
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
    if (output.platform_versions?.facebook) {
      const fb = cleanPostText(output.platform_versions.facebook, output.headline);
      return hashtagLine ? `${fb}\n\n${hashtagLine}` : fb;
    }
    if (output.caption_main) {
      const body = cleanPostText(output.caption_main);
      return `${output.headline || ''}\n\n${body}\n\n${output.cta || ''}${hashtagLine ? '\n\n' + hashtagLine : ''}`;
    }
    const parts = [
      output.title,
      output.opening_hook,
      output.body,
      output.cta,
      hashtagLine || null
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

  async function handleAutoPost() {
    if (!contentId || selectedPageIds.length === 0) {
      toast.error(THAI_UI_LABELS.select_pages);
      return;
    }

    setPosting(true);
    try {
      const postPayload: Record<string, any> = {
        content_id: contentId,
        page_ids: selectedPageIds,
        message: finalTextPreview,
      };

      if (imageUrls && imageUrls.length > 0) {
        postPayload.image_urls = imageUrls;
      }

      const res = await fetch('/api/auto-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postPayload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`${THAI_UI_LABELS.post_success} (${data.posted}/${data.total})`);
      } else {
        toast.error(data.error || THAI_UI_LABELS.post_failed);
      }
    } catch {
      toast.error(THAI_UI_LABELS.post_failed);
    } finally {
      setPosting(false);
    }
  }

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

