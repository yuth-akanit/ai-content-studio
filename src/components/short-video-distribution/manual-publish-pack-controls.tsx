'use client';

import React, { useState, useEffect } from 'react';
import { Copy, ExternalLink, Check, Link, MessageSquare, Hash, Share2, Clipboard } from 'lucide-react';
import type { ShortVideoPlatform } from '@/lib/short-video-distribution/planner';
import type { RealVideoQualityGateV2 } from '@/lib/short-video-distribution/real-video-quality-gate';
import type { ShortVideoPublishReadiness } from '@/lib/short-video-distribution/publish-readiness';
import { toast } from 'sonner';

type ManualPublishPackControlsProps = {
  platform: ShortVideoPlatform;
  videoUrl: string;
  caption: string;
  hashtags: string[];
  cta: string;
  isManualReady: boolean;
  channels: any[];
  previewId: string;
  contentId: string;
  realVideoQualityGate: RealVideoQualityGateV2;
  publishReadiness: ShortVideoPublishReadiness;
};

const PLATFORM_UPLOAD_URLS: Record<ShortVideoPlatform, string> = {
  youtube_shorts: 'https://studio.youtube.com',
  facebook_reels: 'https://www.facebook.com/reels/create',
  instagram_reels: 'https://www.instagram.com',
  tiktok: 'https://www.tiktok.com/upload',
};

export function ManualPublishPackControls({
  platform,
  videoUrl,
  caption,
  hashtags,
  cta,
  isManualReady,
  channels,
  previewId,
  contentId,
  realVideoQualityGate,
  publishReadiness,
}: ManualPublishPackControlsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Filter channels matching the platform
  const platformChannels = (channels || []).filter((c) => {
    if (platform === 'youtube_shorts') return c.provider === 'youtube' || c.provider === 'youtube_shorts';
    if (platform === 'facebook_reels') return c.provider === 'facebook';
    if (platform === 'instagram_reels') return c.provider === 'instagram';
    if (platform === 'tiktok') return c.provider === 'tiktok';
    return false;
  });

  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => {
    return platformChannels[0]?.id || '';
  });

  // Sync selected target when channels or platform change
  useEffect(() => {
    if (platformChannels.length > 0 && !platformChannels.some((c) => c.id === selectedTargetId)) {
      setSelectedTargetId(platformChannels[0].id);
    }
  }, [channels, platform, platformChannels, selectedTargetId]);

  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const isApiReady = !!(
    publishReadiness.publish_allowed &&
    platformChannels.length > 0 &&
    selectedTargetId
  );

  const hashtagText = hashtags.join(' ');
  const uploadUrl = PLATFORM_UPLOAD_URLS[platform];

  const copyToClipboardFallback = (text: string): boolean => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error('Fallback copy failed', err);
      document.body.removeChild(textArea);
      return false;
    }
  };

  const handleCopy = async (field: string, text: string) => {
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch (err) {
        console.warn('navigator.clipboard failed, using fallback', err);
        success = copyToClipboardFallback(text);
      }
    } else {
      success = copyToClipboardFallback(text);
    }

    if (success) {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success('คัดลอกเรียบร้อยแล้ว!');
    }
  };

  const handleCopyAll = async () => {
    const combinedText = `ลิงก์วิดีโอ: ${videoUrl}\n\nแคปชัน: ${caption}\n\nแฮชแท็ก: ${hashtagText}\n\nCTA: ${cta}`;
    await handleCopy('all', combinedText);
  };

  const handlePublishNow = async () => {
    if (!isApiReady) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const res = await fetch('/api/short-video-distribution/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          video_url: videoUrl,
          caption,
          hashtags,
          cta,
          target_id: selectedTargetId,
          preview_id: previewId,
          content_id: contentId,
          real_video_quality_gate_v2: realVideoQualityGate,
          owner_confirmed: true,
          publish_mode: 'owner_manual_click',
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setPublishResult(data);
        toast.success('โพสต์ไปยังสื่อสังคมออนไลน์เสร็จสมบูรณ์!');
      } else {
        const errMsg = data.blocked_reasons?.join(', ') || data.error || 'โพสต์ไปยังระบบจริงไม่สำเร็จ';
        setPublishError(errMsg);
        toast.error(`โพสต์ไม่สำเร็จ: ${errMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อเครือข่าย';
      setPublishError(msg);
      toast.error(`เกิดข้อผิดพลาด: ${msg}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm space-y-4">
      {/* 1. API Publish Now Section */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/20 p-4 space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-bold text-indigo-950 flex items-center gap-1.5">
            <Share2 className="h-4 w-4 text-indigo-600 animate-pulse" />
            API Publish Now (ส่งไปยังช่องทางจริงทันที)
          </h5>
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
            Real API
          </span>
        </div>

        {platformChannels.length > 0 ? (
          <>
            {platformChannels.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`target-channel-select-${platform}`} className="text-xs font-bold text-slate-500">
                  เลือกบัญชีเป้าหมาย:
                </label>
                <select
                  id={`target-channel-select-${platform}`}
                  value={selectedTargetId}
                  onChange={(e) => setSelectedTargetId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none focus:border-indigo-400 font-semibold"
                >
                  {platformChannels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-700">
                บัญชีที่จะใช้โพสต์: <span className="font-bold text-slate-900 bg-white px-2 py-1 border border-slate-100 rounded-md shadow-2xs inline-block mt-1">{platformChannels[0]?.name}</span>
              </div>
            )}

            <button
              type="button"
              disabled={!isApiReady || publishing}
              onClick={handlePublishNow}
              className="w-full min-h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 font-black text-white hover:from-indigo-700 hover:to-indigo-800 shadow-md disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2"
            >
              {publishing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>กำลังส่งข้อมูลโพสต์ไปยัง API...</span>
                </>
              ) : (
                <span>Publish Now (โพสต์จริงทันที)</span>
              )}
            </button>
          </>
        ) : (
          <div className="text-xs text-slate-500 font-semibold leading-relaxed bg-white border border-slate-100 rounded-xl p-3">
            ยังไม่ได้เชื่อมต่อบัญชีสำหรับแพลตฟอร์มนี้ (เชื่อมต่อได้ที่เมนู "สร้างคอนเทนต์ด้วย AI")
          </div>
        )}

        {/* Success / Error Messages */}
        {publishResult?.posted_proof && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="text-sm font-bold text-emerald-950 flex items-center gap-1">
              <Check className="h-4 w-4 text-emerald-600" />
              โพสต์สำเร็จแล้ว!
            </div>
            <p><span className="font-bold text-emerald-900">โพสต์โดย:</span> {publishResult.posted_proof.target_account}</p>
            <p><span className="font-bold text-emerald-900">External ID:</span> {publishResult.posted_proof.external_post_id}</p>
            {publishResult.posted_proof.public_url && (
              <p className="mt-1">
                <a
                  href={publishResult.posted_proof.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-indigo-600 underline flex items-center gap-1 inline-flex hover:text-indigo-800"
                >
                  <ExternalLink className="h-3 w-3" /> เปิดลิงก์โพสต์จริง
                </a>
              </p>
            )}
          </div>
        )}

        {publishError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="text-sm font-bold text-red-950">
              เกิดข้อผิดพลาดในการโพสต์:
            </div>
            <p className="whitespace-pre-line leading-relaxed">{publishError}</p>
          </div>
        )}
      </div>

      {/* 2. Manual Copying / Fallback Package */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <Clipboard className="h-5 w-5 text-slate-600" />
          <h4 className="text-base font-black text-slate-900">คัดลอกข้อมูลเพื่อโพสต์เอง (Manual)</h4>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
            isManualReady
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
              : 'bg-red-50 text-red-700 ring-red-600/20'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${isManualReady ? 'bg-emerald-600' : 'bg-red-600'}`} />
          {isManualReady ? 'พร้อมโพสต์เอง' : 'ยังไม่พร้อม'}
        </span>
      </div>

      {/* Copy notification overlay/alert */}
      {copiedField && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 border border-emerald-200 animate-in fade-in slide-in-from-top-1 duration-200">
          <Check className="h-4 w-4 text-emerald-600" />
          <span>
            คัดลอก
            {copiedField === 'all'
              ? 'ข้อมูลทั้งหมด'
              : copiedField === 'url'
              ? 'ลิงก์วิดีโอ'
              : copiedField === 'caption'
              ? 'แคปชัน'
              : copiedField === 'hashtags'
              ? 'แฮชแท็ก'
              : 'CTA'}
            เรียบร้อยแล้ว!
          </span>
        </div>
      )}

      {/* Form Fields / Preview */}
      <div className="space-y-3">
        {/* Video URL */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1"><Link className="h-3.5 w-3.5" /> ลิงก์วิดีโอ (Video URL)</span>
            <button
              type="button"
              onClick={() => handleCopy('url', videoUrl)}
              disabled={!videoUrl}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
              <span>คัดลอกลิงก์วิดีโอ</span>
            </button>
          </div>
          <div className="mt-1 break-all text-xs font-mono text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
            {videoUrl || 'ไม่มี URL วิดีโอ'}
          </div>
        </div>

        {/* Caption */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> แคปชัน (Caption)</span>
            <button
              type="button"
              onClick={() => handleCopy('caption', caption)}
              disabled={!caption}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
              <span>คัดลอกแคปชัน</span>
            </button>
          </div>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-900 whitespace-pre-wrap bg-slate-50 p-2 rounded-lg border border-slate-200">
            {caption || 'ไม่มีแคปชัน'}
          </p>
        </div>

        {/* Hashtags */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span className="flex items-center gap-1"><Hash className="h-3.5 w-3.5" /> แฮชแท็ก (Hashtags)</span>
            <button
              type="button"
              onClick={() => handleCopy('hashtags', hashtagText)}
              disabled={!hashtagText}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
              <span>คัดลอกแฮชแท็ก</span>
            </button>
          </div>
          <p className="mt-1 text-xs font-mono text-indigo-900 bg-slate-50 p-2 rounded-lg border border-slate-200 font-semibold">
            {hashtagText || '-'}
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col gap-1.5 rounded-xl border border-slate-100 bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>CTA (ข้อความชวนให้ติดต่อ)</span>
            <button
              type="button"
              onClick={() => handleCopy('cta', cta)}
              disabled={!cta}
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
            >
              <Copy className="h-3 w-3" />
              <span>คัดลอก CTA</span>
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200 font-semibold">
            {cta || 'ไม่มี CTA'}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={handleCopyAll}
          className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-800 hover:bg-slate-50 shadow-2xs transition-colors"
        >
          <Clipboard className="h-4 w-4 text-indigo-600" />
          <span>คัดลอกทั้งหมด</span>
        </button>

        <button
          type="button"
          onClick={() => window.open(uploadUrl, '_blank', 'noopener,noreferrer')}
          className="flex-1 min-h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800 shadow-sm transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          <span>เปิดหน้าอัปโหลด</span>
        </button>
      </div>
    </div>
  );
}
