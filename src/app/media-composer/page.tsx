'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Film, ImagePlus, Loader2, ShieldCheck, Volume2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { sampleMediaComposerImagePairInput, sampleMediaComposerRawVideoInput, type MediaComposerMasterVideoRecord, type MediaComposerSourceBadge, type MediaComposerSourceType } from '@/lib/media-composer';
import type { MediaComposerSourceOption } from '@/lib/media-composer-real-media-adapter';

type ComposerResponse = {
  ok: boolean;
  error?: string;
  errors?: string[];
  master_video?: MediaComposerMasterVideoRecord;
  production_actions_performed: false;
};

type SourcesResponse = {
  ok: boolean;
  source_options?: MediaComposerSourceOption[];
  fallback_used?: boolean;
  source_counts?: Record<MediaComposerSourceBadge, number>;
  production_actions_performed: false;
};

type InputState = {
  source_type: MediaComposerSourceType;
  before_image_url: string;
  after_image_url: string;
  raw_video_url: string;
  tts_script: string;
  cta_banner: string;
  source_id?: string;
  source_badge?: MediaComposerSourceBadge;
};

const defaultState: InputState = {
  source_type: 'image_pair',
  before_image_url: sampleMediaComposerImagePairInput.before_image_url,
  after_image_url: sampleMediaComposerImagePairInput.after_image_url,
  raw_video_url: sampleMediaComposerRawVideoInput.raw_video_url,
  tts_script: sampleMediaComposerImagePairInput.tts_script,
  cta_banner: sampleMediaComposerImagePairInput.cta_banner || 'ทัก PA Air Service เพื่อจองคิวล้างแอร์',
  source_id: 'sample-image-pair',
  source_badge: 'sample',
};

function flagLabel(value: boolean): string {
  return value ? 'เปิด' : 'ปิด';
}

function buildRequestBody(state: InputState) {
  if (state.source_type === 'image_pair') {
    return {
      source_type: 'image_pair',
      before_image_url: state.before_image_url,
      after_image_url: state.after_image_url,
      tts_script: state.tts_script,
      cta_banner: state.cta_banner,
      brand: 'PA Air Service',
      source_id: state.source_id,
      source_badge: state.source_badge,
    };
  }

  return {
    source_type: 'raw_video',
    raw_video_url: state.raw_video_url,
    tts_script: state.tts_script,
    cta_banner: state.cta_banner,
    brand: 'PA Air Service',
    source_id: state.source_id,
    source_badge: state.source_badge,
  };
}
export default function MediaComposerPage() {
  const [state, setState] = useState<InputState>(defaultState);
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(true);
  const [sourceOptions, setSourceOptions] = useState<MediaComposerSourceOption[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('sample-image-pair');
  const [fallbackUsed, setFallbackUsed] = useState(true);
  const [result, setResult] = useState<ComposerResponse | null>(null);

  const sourceSummary = useMemo(() => {
    if (state.source_type === 'image_pair') return 'สร้างจากภาพก่อน/หลัง พร้อม pan/zoom/crossfade';
    return 'รีเฟรม raw video เป็น 9:16 ลดเสียงเดิม และใส่ TTS/subtitle/CTA';
  }, [state.source_type]);

  useEffect(() => {
    let cancelled = false;
    async function loadSources() {
      setLoadingSources(true);
      try {
        const response = await fetch('/api/media-composer/sources', { cache: 'no-store' });
        const data = (await response.json()) as SourcesResponse;
        if (cancelled) return;
        const options = data.source_options || [];
        setSourceOptions(options);
        setFallbackUsed(Boolean(data.fallback_used));
        const first = options[0];
        if (first) applySourceOption(first);
      } catch {
        if (!cancelled) {
          setSourceOptions([]);
          setFallbackUsed(true);
        }
      } finally {
        if (!cancelled) setLoadingSources(false);
      }
    }
    loadSources();
    return () => {
      cancelled = true;
    };
  }, []);

  function applySourceOption(option: MediaComposerSourceOption) {
    setSelectedSourceId(option.id);
    if (option.input.source_type === 'image_pair') {
      setState({
        source_type: 'image_pair',
        before_image_url: option.input.before_image_url,
        after_image_url: option.input.after_image_url,
        raw_video_url: sampleMediaComposerRawVideoInput.raw_video_url,
        tts_script: option.input.tts_script,
        cta_banner: option.input.cta_banner || defaultState.cta_banner,
        source_id: option.input.source_id || option.id,
        source_badge: option.input.source_badge || option.source_badge,
      });
      return;
    }

    setState({
      source_type: 'raw_video',
      before_image_url: sampleMediaComposerImagePairInput.before_image_url,
      after_image_url: sampleMediaComposerImagePairInput.after_image_url,
      raw_video_url: option.input.raw_video_url,
      tts_script: option.input.tts_script,
      cta_banner: option.input.cta_banner || defaultState.cta_banner,
      source_id: option.input.source_id || option.id,
      source_badge: option.input.source_badge || option.source_badge,
    });
  }

  async function renderPreview() {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('/api/media-composer/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildRequestBody(state)),
      });
      const data = (await response.json()) as ComposerResponse;
      setResult(data);
    } catch (error) {
      setResult({
        ok: false,
        error: error instanceof Error ? error.message : 'media_composer_request_failed',
        production_actions_performed: false,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Media Composer v1"
        description="สร้าง master video แนวตั้งจากภาพคู่หรือ raw video สำหรับส่งต่อไปหน้า Short Video Distribution แบบ preview-only"
      />

      <Card className="border-amber-200 bg-amber-50 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-amber-700" />
            <div>
              <div className="text-base font-black text-amber-950">Preview/render only — ไม่โพสต์จริง</div>
              <p className="text-sm text-amber-900">ไม่มี Facebook/Instagram/TikTok/YouTube API, ไม่มี LINE broadcast, ไม่มี scheduler และไม่แตะ TikTok OAuth</p>
            </div>
          </div>
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">production_actions_performed=false</Badge>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <Film className="h-5 w-5 text-indigo-600" />
              Composer Input Model
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-indigo-950">Read-only real media adapter</div>
                  <p className="text-sm leading-6 text-indigo-900">
                    โหลดเฉพาะ metadata จาก Product Video preview logs ที่อนุมัติแล้วหรือ safe media URL; ไม่มีการ mutate DB และไม่มี publish API
                  </p>
                </div>
                <Badge variant="outline" className="border-indigo-200 bg-white text-indigo-700">
                  {fallbackUsed ? 'sample fallback' : 'real media available'}
                </Badge>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="media-source">เลือกแหล่ง media</Label>
                <select
                  id="media-source"
                  value={selectedSourceId}
                  disabled={loadingSources || sourceOptions.length === 0}
                  onChange={(event) => {
                    const option = sourceOptions.find((item) => item.id === event.target.value);
                    if (option) applySourceOption(option);
                  }}
                  className="min-h-11 w-full rounded-2xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none ring-indigo-500/20 transition focus:border-indigo-500 focus:ring-4"
                >
                  {loadingSources ? <option>กำลังโหลด source แบบ read-only...</option> : null}
                  {sourceOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      [{option.source_badge}] {option.label}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 text-xs text-indigo-950 sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-indigo-100">source_badge: <b>{state.source_badge || 'sample'}</b></div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-indigo-100">source_id: <b>{state.source_id || 'sample-image-pair'}</b></div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setState((current) => ({ ...current, source_type: 'image_pair' }))}
                className={`rounded-2xl border p-4 text-left transition ${state.source_type === 'image_pair' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <ImagePlus className="h-5 w-5 text-indigo-600" />
                <div className="mt-2 font-black text-slate-950">Image Pair</div>
                <p className="text-sm leading-6 text-slate-600">before_image_url + after_image_url → 1080x1920 MP4</p>
              </button>
              <button
                type="button"
                onClick={() => setState((current) => ({ ...current, source_type: 'raw_video' }))}
                className={`rounded-2xl border p-4 text-left transition ${state.source_type === 'raw_video' ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
              >
                <Volume2 className="h-5 w-5 text-indigo-600" />
                <div className="mt-2 font-black text-slate-950">Raw Video</div>
                <p className="text-sm leading-6 text-slate-600">raw_video_url → normalize 9:16 + TTS/subtitle/CTA</p>
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-700 ring-1 ring-slate-100">{sourceSummary}</div>

            {state.source_type === 'image_pair' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="before_image_url" value={state.before_image_url} onChange={(value) => setState((current) => ({ ...current, before_image_url: value }))} />
                <Field label="after_image_url" value={state.after_image_url} onChange={(value) => setState((current) => ({ ...current, after_image_url: value }))} />
              </div>
            ) : (
              <Field label="raw_video_url" value={state.raw_video_url} onChange={(value) => setState((current) => ({ ...current, raw_video_url: value }))} />
            )}

            <div className="space-y-2">
              <Label htmlFor="tts-script">tts_script</Label>
              <Textarea id="tts-script" value={state.tts_script} onChange={(event) => setState((current) => ({ ...current, tts_script: event.target.value }))} className="min-h-28" />
            </div>

            <Field label="CTA banner" value={state.cta_banner} onChange={(value) => setState((current) => ({ ...current, cta_banner: value }))} />

            <Button onClick={renderPreview} disabled={loading} className="min-h-11 rounded-2xl bg-indigo-600 px-5 font-black text-white hover:bg-indigo-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
              Render Preview Master Video
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-950">Master Video Output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">กด Render Preview เพื่อสร้าง master_video record แบบ local preview</p>}
            {result && !result.ok && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <div className="font-black">Render ไม่ผ่าน</div>
                <p>{result.error}</p>
                {result.errors?.length ? <ul className="mt-2 list-disc pl-5">{result.errors.map((item) => <li key={item}>{item}</li>)}</ul> : null}
              </div>
            )}
            {result?.ok && result.master_video ? (
              <div className="space-y-4">
                <video className="mx-auto aspect-[9/16] max-h-[540px] w-full max-w-[304px] rounded-3xl bg-slate-950 shadow-lg" controls preload="metadata" playsInline>
                  <source src={result.master_video.master_video_url} type="video/mp4" />
                  Browser ไม่รองรับวิดีโอ MP4
                </video>
                <div className="grid gap-2 text-sm text-slate-700">
                  <OutputLine label="master_video_url" value={result.master_video.master_video_url} />
                  <OutputLine label="duration_seconds" value={`${result.master_video.duration_seconds}`} />
                  <OutputLine label="source_type" value={result.master_video.source_type} />
                  <OutputLine label="source_badge" value={result.master_video.source_badge} />
                  <OutputLine label="source_id" value={result.master_video.source_id || '-'} />
                  <OutputLine label="ready_for_distribution_preview" value="true" />
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                  <div className="font-black">Publish flags ทั้งหมดปิด</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {Object.entries(result.master_video.publish_flags).map(([key, value]) => (
                      <div key={key} className="flex justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-emerald-100">
                        <span>{key}</span>
                        <b>{flagLabel(value)}</b>
                      </div>
                    ))}
                  </div>
                </div>
                <Link href="/short-video-distribution" className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 font-black text-slate-900 hover:bg-slate-50">
                  เปิด Short Video Distribution Preview <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none ring-indigo-500/20 transition focus:border-indigo-500 focus:ring-4"
      />
    </div>
  );
}

function OutputLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
      <div className="text-xs font-bold text-slate-500">{label}</div>
      <div className="mt-1 break-words font-black text-slate-950">{value}</div>
    </div>
  );
}
