'use client';

import React, { useState } from 'react';
import { Copy, ExternalLink, Check, Link, MessageSquare, Hash, Share2, Clipboard } from 'lucide-react';
import type { ShortVideoPlatform } from '@/lib/short-video-distribution/planner';

type ManualPublishPackControlsProps = {
  platform: ShortVideoPlatform;
  videoUrl: string;
  caption: string;
  hashtags: string[];
  cta: string;
  isManualReady: boolean;
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
}: ManualPublishPackControlsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

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
    }
  };

  const handleCopyAll = async () => {
    const combinedText = `ลิงก์วิดีโอ: ${videoUrl}\n\nแคปชัน: ${caption}\n\nแฮชแท็ก: ${hashtagText}\n\nCTA: ${cta}`;
    await handleCopy('all', combinedText);
  };

  return (
    <div className="mt-4 rounded-2xl border border-indigo-100 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-indigo-600" />
          <h4 className="text-base font-black text-slate-900">พร้อมโพสต์เอง</h4>
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

      {/* Copy notification */}
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
