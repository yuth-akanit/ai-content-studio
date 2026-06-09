'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Film, ImagePlus, Loader2, ShieldCheck, Sparkles, Upload, Volume2 } from 'lucide-react';
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
  short_video_distribution_preview_url?: string;
  production_actions_performed: false;
};

type SourcesResponse = {
  ok: boolean;
  source_options?: MediaComposerSourceOption[];
  fallback_used?: boolean;
  source_counts?: Record<MediaComposerSourceBadge, number>;
  production_actions_performed: false;
};

type UploadKind = 'raw_video' | 'before_image' | 'after_image' | 'voiceover_audio';

type AudioMixMode = 'voiceover_only' | 'duck_original_with_voiceover' | 'original_only';

type TtsPreset = {
  id: 'paa_air_service' | 'pa_cooling_solutions' | 'cold_room_refrigeration' | 'syncflow';
  brand: string;
  title: string;
  segment: string;
  provider: 'google';
  voiceName: string;
  voiceLabel: string;
  script: string;
  cta: string;
};

type MediaComposerUploadResponse = {
  ok: boolean;
  status?: 'upload_success';
  error?: string;
  upload_kind?: UploadKind;
  asset_id?: string;
  filename?: string;
  mime_type?: string;
  size_bytes?: number;
  public_media_url?: string;
  source_badge?: MediaComposerSourceBadge;
  source_option?: MediaComposerSourceOption;
  all_publish_flags_false?: true;
  external_api_calls_performed?: false;
  production_actions_performed?: false;
};

type VoiceoverGenerateResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  voiceover_audio_url?: string;
  asset_id?: string;
  media_type?: 'audio';
  mime_type?: string;
  source_badge?: 'generated_voiceover';
  tts_provider?: string;
  tts_model?: string;
  voice_name?: string;
  key_present?: boolean;
  external_tts_calls_performed?: boolean;
  production_actions_performed?: false;
};

type InputMode = 'existing' | 'upload';

type InputState = {
  brand: string;
  source_type: MediaComposerSourceType;
  before_image_url: string;
  after_image_url: string;
  raw_video_url: string;
  voiceover_audio_url: string;
  voiceover_enabled: boolean;
  audio_mix_mode: AudioMixMode;
  tts_script: string;
  cta_banner: string;
  source_id?: string;
  source_badge?: MediaComposerSourceBadge;
};

const THAI_TTS_PRESETS: TtsPreset[] = [
  {
    id: 'paa_air_service',
    brand: 'PAA Air Service',
    title: 'PAA Air Service',
    segment: 'ล้างแอร์บ้าน/คอนโด',
    provider: 'google',
    voiceName: 'th-TH-Chirp3-HD-Charon',
    voiceLabel: 'Thai male · Google Chirp3-HD Charon',
    script: 'แอร์ไม่ค่อยเย็น มีกลิ่นอับ อาจถึงเวลาล้างแอร์แล้ว จองคิวกับพีเอเอได้เลย',
    cta: 'ทัก PAA Air Service เพื่อจองคิวล้างแอร์',
  },
  {
    id: 'pa_cooling_solutions',
    brand: 'PA Cooling Solutions',
    title: 'PA Cooling Solutions',
    segment: 'งานระบบแอร์เชิงพาณิชย์',
    provider: 'google',
    voiceName: 'th-TH-Chirp3-HD-Puck',
    voiceLabel: 'Thai male · Google Chirp3-HD Puck',
    script: 'ระบบแอร์ร้านค้าไม่เย็นทั่วถึง ค่าไฟสูงขึ้น หรือเครื่องทำงานหนัก ให้พีเอคูลลิ่งช่วยตรวจและวางแผนแก้ไขได้',
    cta: 'นัดสำรวจระบบแอร์กับ PA Cooling Solutions',
  },
  {
    id: 'cold_room_refrigeration',
    brand: 'Cold Room & Refrigeration',
    title: 'ห้องเย็น / ระบบทำความเย็น',
    segment: 'ร้านอาหาร โกดัง สินค้าแช่เย็น',
    provider: 'google',
    voiceName: 'th-TH-Chirp3-HD-Achird',
    voiceLabel: 'Thai male · Google Chirp3-HD Achird',
    script: 'ห้องเย็นอุณหภูมิไม่นิ่ง น้ำแข็งเกาะ หรือคอมเพรสเซอร์ทำงานหนัก ควรตรวจระบบก่อนสินค้าเสียหาย',
    cta: 'ขอคำปรึกษางานห้องเย็นและระบบทำความเย็น',
  },
  {
    id: 'syncflow',
    brand: 'SyncFlow',
    title: 'SyncFlow',
    segment: 'รับงาน-จัดช่าง-ออกบิล',
    provider: 'google',
    voiceName: 'th-TH-Chirp3-HD-Charon',
    voiceLabel: 'Thai male · Google Chirp3-HD Charon',
    script: 'งานบริการไม่ควรหลุดคิว SyncFlow ช่วยรับงาน จัดช่าง ติดตามสถานะ และออกบิลให้ทีมเห็นภาพเดียวกัน',
    cta: 'ดูเดโม SyncFlow สำหรับทีมบริการภาคสนาม',
  },
];

const defaultPreset = THAI_TTS_PRESETS[0];

const defaultState: InputState = {
  brand: defaultPreset.brand,
  source_type: 'image_pair',
  before_image_url: sampleMediaComposerImagePairInput.before_image_url,
  after_image_url: sampleMediaComposerImagePairInput.after_image_url,
  raw_video_url: sampleMediaComposerRawVideoInput.raw_video_url,
  voiceover_audio_url: '',
  voiceover_enabled: true,
  audio_mix_mode: 'voiceover_only',
  tts_script: defaultPreset.script,
  cta_banner: defaultPreset.cta,
  source_id: 'sample-image-pair',
  source_badge: 'sample',
};

function flagLabel(value: boolean): string {
  return value ? 'เปิด' : 'ปิด';
}

function sourceBadgeDescription(badge?: MediaComposerSourceBadge): string {
  switch (badge) {
    case 'sample':
      return 'sample — ไฟล์ตัวอย่างของระบบ ใช้เมื่อยังไม่มี media จริงให้เลือก';
    case 'minio_safe_url':
      return 'minio_safe_url — ไฟล์นี้มาจาก media ที่เคยอัปโหลด/สร้างไว้ในระบบ';
    case 'product_video_preview_log':
      return 'product_video_preview_log — ไฟล์นี้มาจาก media ที่เคยอัปโหลด/สร้างไว้ในระบบ';
    case 'uploaded_asset':
      return 'uploaded_asset — ไฟล์นี้มาจาก media ที่เคยอัปโหลด/สร้างไว้ในระบบ';
    default:
      return 'sample — ไฟล์ตัวอย่างของระบบ';
  }
}

function buildRequestBody(state: InputState) {
  if (state.source_type === 'image_pair') {
    return {
      source_type: 'image_pair',
      before_image_url: state.before_image_url,
      after_image_url: state.after_image_url,
      tts_script: state.tts_script,
      cta_banner: state.cta_banner,
      brand: state.brand || 'PA Air Service',
      source_id: state.source_id,
      source_badge: state.source_badge,
    };
  }

  return {
    source_type: 'raw_video',
    raw_video_url: state.raw_video_url,
    voiceover_audio_url: state.voiceover_audio_url,
    voiceover_enabled: true,
    audio_mix_mode: state.audio_mix_mode || 'voiceover_only',
    tts_script: state.tts_script,
    cta_banner: state.cta_banner,
    brand: state.brand || 'PA Air Service',
    source_id: state.source_id,
    source_badge: state.source_badge,
  };
}
export default function MediaComposerPage() {
  const [state, setState] = useState<InputState>(defaultState);
  const [activePresetId, setActivePresetId] = useState<TtsPreset['id']>(defaultPreset.id);
  const [inputMode, setInputMode] = useState<InputMode>('existing');
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(true);
  const [uploadingKind, setUploadingKind] = useState<UploadKind | null>(null);
  const [uploadSummary, setUploadSummary] = useState<Partial<Record<UploadKind, MediaComposerUploadResponse>>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [generatingVoiceover, setGeneratingVoiceover] = useState(false);
  const [voiceoverResult, setVoiceoverResult] = useState<VoiceoverGenerateResponse | null>(null);
  const [sourceOptions, setSourceOptions] = useState<MediaComposerSourceOption[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('sample-image-pair');
  const [fallbackUsed, setFallbackUsed] = useState(true);
  const [result, setResult] = useState<ComposerResponse | null>(null);

  const sourceSummary = useMemo(() => {
    if (state.source_type === 'image_pair') return 'สร้างจากภาพก่อน/หลัง พร้อม pan/zoom/crossfade';
    if (state.source_badge === 'uploaded_asset') return 'Real Render v2: สร้าง composed preview MP4 ใหม่จาก uploaded raw video พร้อม 9:16 canvas, title/subtitle/CTA overlay';
    return 'Passthrough preview: ใช้ raw_video_url เดิมเป็น master_video_url เพื่อ manual preview เท่านั้น';
  }, [state.source_type, state.source_badge]);

  const selectedSourceOption = useMemo(
    () => sourceOptions.find((option) => option.id === selectedSourceId),
    [sourceOptions, selectedSourceId],
  );

  const activePreset = useMemo(
    () => THAI_TTS_PRESETS.find((preset) => preset.id === activePresetId) || defaultPreset,
    [activePresetId],
  );

  const scriptCharacterCount = Array.from(state.tts_script || '').length;
  const scriptLimit = 350;

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
        brand: currentBrand(),
        source_type: 'image_pair',
        before_image_url: option.input.before_image_url,
        after_image_url: option.input.after_image_url,
        raw_video_url: sampleMediaComposerRawVideoInput.raw_video_url,
        voiceover_audio_url: state.voiceover_audio_url,
        voiceover_enabled: state.voiceover_enabled,
        audio_mix_mode: state.audio_mix_mode,
        tts_script: option.input.tts_script,
        cta_banner: option.input.cta_banner || defaultState.cta_banner,
        source_id: option.input.source_id || option.id,
        source_badge: option.input.source_badge || option.source_badge,
      });
      return;
    }

    setState({
      brand: currentBrand(),
      source_type: 'raw_video',
      before_image_url: sampleMediaComposerImagePairInput.before_image_url,
      after_image_url: sampleMediaComposerImagePairInput.after_image_url,
      raw_video_url: option.input.raw_video_url,
      voiceover_audio_url: state.voiceover_audio_url,
      voiceover_enabled: state.voiceover_enabled,
      audio_mix_mode: state.audio_mix_mode,
      tts_script: option.input.tts_script,
      cta_banner: option.input.cta_banner || defaultState.cta_banner,
      source_id: option.input.source_id || option.id,
      source_badge: option.input.source_badge || option.source_badge,
    });
  }

  function currentBrand(): string {
    return state.brand || activePreset.brand || defaultPreset.brand;
  }

  function applyTtsPreset(preset: TtsPreset) {
    setActivePresetId(preset.id);
    setState((current) => ({
      ...current,
      brand: preset.brand,
      tts_script: preset.script,
      cta_banner: preset.cta,
    }));
    setVoiceoverResult(null);
  }

  async function uploadDirectFile(kind: UploadKind, file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploadingKind(kind);
    try {
      const formData = new FormData();
      formData.set('upload_kind', kind);
      formData.set('file', file);
      const response = await fetch('/api/media-composer/assets/upload', {
        method: 'POST',
        body: formData,
      });
      const data = (await response.json()) as MediaComposerUploadResponse;
      if (!response.ok || !data.ok || !data.public_media_url) {
        throw new Error(data.error || 'media_composer_upload_failed');
      }

      const nextSummary = { ...uploadSummary, [kind]: data };
      setUploadSummary(nextSummary);
      setInputMode('upload');
      const sourceId = data.source_option?.id || `uploaded-asset-${data.asset_id || kind}`;
      setSelectedSourceId(sourceId);

      if (kind === 'raw_video') {
        setState((current) => ({
          ...current,
          source_type: 'raw_video',
          raw_video_url: data.public_media_url || '',
          source_id: sourceId,
          source_badge: 'uploaded_asset',
        }));
        return;
      }

      if (kind === 'voiceover_audio') {
        setState((current) => ({
          ...current,
          voiceover_audio_url: data.public_media_url || '',
          voiceover_enabled: true,
          audio_mix_mode: 'voiceover_only',
        }));
        return;
      }

      const beforeUrl = kind === 'before_image'
        ? data.public_media_url
        : nextSummary.before_image?.public_media_url || state.before_image_url;
      const afterUrl = kind === 'after_image'
        ? data.public_media_url
        : nextSummary.after_image?.public_media_url || state.after_image_url;
      const beforeId = kind === 'before_image' ? data.asset_id : nextSummary.before_image?.asset_id;
      const afterId = kind === 'after_image' ? data.asset_id : nextSummary.after_image?.asset_id;
      setState((current) => ({
        ...current,
        source_type: 'image_pair',
        before_image_url: beforeUrl || current.before_image_url,
        after_image_url: afterUrl || current.after_image_url,
        source_id: `uploaded-asset-image-pair-${beforeId || 'before'}-${afterId || 'after'}`,
        source_badge: 'uploaded_asset',
      }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'media_composer_upload_failed');
    } finally {
      setUploadingKind(null);
    }
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

  async function generateVoiceoverPreview() {
    setGeneratingVoiceover(true);
    setVoiceoverResult(null);
    try {
      const response = await fetch('/api/media-composer/voiceover/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tts_script: state.tts_script,
          voice: 'thai_natural_male',
          voice_name: activePreset.voiceName,
          language: 'th-TH',
          source_badge: 'generated_voiceover',
        }),
      });
      const data = (await response.json()) as VoiceoverGenerateResponse;
      setVoiceoverResult(data);
      if (response.ok && data.ok && data.voiceover_audio_url) {
        setState((current) => ({
          ...current,
          voiceover_audio_url: data.voiceover_audio_url || '',
          voiceover_enabled: true,
          audio_mix_mode: 'voiceover_only',
        }));
      }
    } catch (error) {
      setVoiceoverResult({
        ok: false,
        error: error instanceof Error ? error.message : 'media_composer_voiceover_generate_failed',
        external_tts_calls_performed: false,
        production_actions_performed: false,
      });
    } finally {
      setGeneratingVoiceover(false);
    }
  }

  const isUploadedMediaAssetUrl = (value?: string) => Boolean(value && value.includes('/api/product-video/assets/'));
  const canRenderMasterVideo =
    (state.source_type === 'raw_video' && isUploadedMediaAssetUrl(state.raw_video_url)) ||
    (state.source_type === 'image_pair' &&
      isUploadedMediaAssetUrl(state.before_image_url) &&
      isUploadedMediaAssetUrl(state.after_image_url));
  const renderBlockedMessage = 'กรุณาอัปโหลดรูปหรือวิดีโอก่อน Render';

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
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setInputMode('existing')}
                className={`min-h-14 rounded-2xl border p-4 text-left text-sm font-black transition ${inputMode === 'existing' ? 'border-indigo-500 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                เลือกจาก media ในระบบ
                <span className="mt-1 block text-xs font-semibold">sample / minio_safe_url / product_video_preview_log</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`min-h-14 rounded-2xl border p-4 text-left text-sm font-black transition ${inputMode === 'upload' ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
              >
                อัปโหลดใหม่โดยตรง
                <span className="mt-1 block text-xs font-semibold">source_badge=uploaded_asset สำหรับ mobile owner/admin</span>
              </button>
            </div>

            {inputMode === 'existing' && (
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
                <div className="rounded-2xl border border-indigo-100 bg-white p-3 text-sm leading-6 text-indigo-950">
                  <div className="font-black">ที่มาของ media ที่เลือก</div>
                  <p>{sourceBadgeDescription(state.source_badge)}</p>
                  {selectedSourceOption?.source_url_summary ? (
                    <p className="mt-1 break-words text-xs text-indigo-800">source_url_summary: {selectedSourceOption.source_url_summary}</p>
                  ) : null}
                  <p className="mt-2 text-xs font-bold text-amber-700">หากต้องการอัปโหลดไฟล์ใหม่ ให้เลือกโหมด “อัปโหลดใหม่โดยตรง”</p>
                </div>
              </div>
            </div>
            )}

            {inputMode === 'upload' && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950">
              <div className="flex items-center gap-2 font-black">
                <Upload className="h-4 w-4 text-emerald-700" />
                Direct Upload — อัปโหลดจากหน้านี้โดยตรง
              </div>
              <p className="mt-1 leading-6">อัปโหลดใหม่โดยตรงสำหรับเจ้าของ/แอดมินบนมือถือ ระบบจะเก็บใน safe uploaded asset storage และตั้ง source_badge=uploaded_asset โดยไม่โพสต์จริง</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-4">
                <UploadButton label="Upload Raw Video" accept="video/*" uploading={uploadingKind === 'raw_video'} onFile={(file) => uploadDirectFile('raw_video', file)} />
                <UploadButton label="Upload Voiceover Audio" accept="audio/*" uploading={uploadingKind === 'voiceover_audio'} onFile={(file) => uploadDirectFile('voiceover_audio', file)} />
                <UploadButton label="Upload Before Image" accept="image/*" uploading={uploadingKind === 'before_image'} onFile={(file) => uploadDirectFile('before_image', file)} />
                <UploadButton label="Upload After Image" accept="image/*" uploading={uploadingKind === 'after_image'} onFile={(file) => uploadDirectFile('after_image', file)} />
              </div>
              {uploadError ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">Upload error: {uploadError}</div> : null}
              <div className="mt-3 grid gap-2">
                {(['raw_video', 'voiceover_audio', 'before_image', 'after_image'] as UploadKind[]).map((kind) => (
                  <UploadSummaryLine key={kind} kind={kind} item={uploadSummary[kind]} />
                ))}
              </div>
            </div>
            )}

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
                <p className="text-sm leading-6 text-slate-600">uploaded_asset → composed preview MP4; other raw_video_url → passthrough preview</p>
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

            <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-black text-sky-950"><Sparkles className="h-4 w-4 text-sky-700" /> Brand / Script / TTS presets</div>
                  <p className="mt-1 text-sm leading-6 text-sky-900">เลือกการ์ดเพื่อเติมสคริปต์ภาษาไทย แล้วแก้ไข preview ได้ก่อน Generate Voiceover</p>
                </div>
                <Badge variant="outline" className="border-sky-200 bg-white text-sky-800">provider={activePreset.provider} · voice={activePreset.voiceName}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {THAI_TTS_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyTtsPreset(preset)}
                    className={`rounded-2xl border p-4 text-left transition ${activePresetId === preset.id ? 'border-sky-500 bg-white ring-2 ring-sky-100' : 'border-sky-100 bg-white/70 hover:bg-white'}`}
                  >
                    <div className="font-black text-slate-950">{preset.title}</div>
                    <div className="mt-1 text-xs font-bold text-sky-700">{preset.segment}</div>
                    <div className="mt-2 text-xs text-slate-600">{preset.voiceLabel}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="tts-script">Editable script preview</Label>
                <span className={`text-xs font-black ${scriptCharacterCount > scriptLimit ? 'text-red-600' : 'text-slate-500'}`}>{scriptCharacterCount}/{scriptLimit} chars</span>
              </div>
              <Textarea id="tts-script" value={state.tts_script} onChange={(event) => setState((current) => ({ ...current, tts_script: event.target.value }))} className="min-h-32 text-base leading-7" />
              <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">brand: <b>{state.brand}</b></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">provider: <b>{activePreset.provider}</b></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">voice: <b>{activePreset.voiceName}</b></div>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 text-sm text-indigo-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-black">AI Voiceover</div>
                  <p className="mt-1 leading-6">Generate Thai Voiceover Preview จาก tts_script หรือใช้อัปโหลด voiceover_audio เองได้ ค่าเริ่มต้นคือ voiceover_only — ตัดเสียงต้นฉบับออกจาก MP4</p>
                </div>
                <Badge className="bg-indigo-600 text-white hover:bg-indigo-600">audio_mix_mode={state.audio_mix_mode}</Badge>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <select
                  value={state.audio_mix_mode}
                  onChange={(event) => setState((current) => ({ ...current, audio_mix_mode: event.target.value as AudioMixMode }))}
                  className="min-h-11 rounded-2xl border border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none ring-indigo-500/20 transition focus:border-indigo-500 focus:ring-4"
                >
                  <option value="voiceover_only">voiceover_only — ใช้เสียงบรรยายเท่านั้น</option>
                  <option value="duck_original_with_voiceover">duck_original_with_voiceover — ลดเสียงต้นฉบับ (ต้องเลือกเองภายหลัง)</option>
                  <option value="original_only">original_only — ใช้เสียงต้นฉบับเท่านั้น</option>
                </select>
                <Button type="button" onClick={generateVoiceoverPreview} disabled={generatingVoiceover} className="min-h-11 rounded-2xl bg-indigo-600 px-4 font-black text-white hover:bg-indigo-700">
                  {generatingVoiceover ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                  Generate Thai Voiceover Preview
                </Button>
              </div>
              {voiceoverResult?.ok ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                  voiceover generated · Voice: {voiceoverResult.voice_name || 'not reported'} · Provider/Model: {voiceoverResult.tts_provider || activePreset.provider}/{voiceoverResult.tts_model || 'not reported'} · external_tts_calls_performed={String(voiceoverResult.external_tts_calls_performed)}
                </div>
              ) : null}
              {voiceoverResult && !voiceoverResult.ok ? (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                  {voiceoverResult.error}: {voiceoverResult.message || 'ไม่เรียก external TTS'} · external_tts_calls_performed=false
                </div>
              ) : null}
              {state.voiceover_audio_url ? (
                <div className="mt-3 space-y-2 rounded-xl bg-white p-3 ring-1 ring-indigo-100">
                  <audio controls className="w-full" src={state.voiceover_audio_url} />
                  <OutputLine label="generated/manual voiceover_audio_url" value={state.voiceover_audio_url} />
                </div>
              ) : null}
            </div>

            <Field label="CTA banner" value={state.cta_banner} onChange={(value) => setState((current) => ({ ...current, cta_banner: value }))} />

            <div className="space-y-2">
              <Button onClick={renderPreview} disabled={loading || !canRenderMasterVideo} className="min-h-11 rounded-2xl bg-indigo-600 px-5 font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
                Render Preview Master Video
              </Button>
              {!canRenderMasterVideo ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  {renderBlockedMessage}
                </p>
              ) : null}
            </div>
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
                  <OutputLine label="render_mode" value={result.master_video.render_mode} />
                  <OutputLine label="renderer_status" value={result.master_video.renderer_status} />
                  <OutputLine label="fallback_used" value={`${result.master_video.fallback_used}`} />
                  <OutputLine label="master_video_url_is_original_upload" value={`${result.master_video.master_video_url_is_original_upload}`} />
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
                <Link href={result.short_video_distribution_preview_url || '/short-video-distribution'} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 font-black text-slate-900 hover:bg-slate-50">
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

function UploadButton({ label, accept, uploading, onFile }: { label: string; accept: string; uploading: boolean; onFile: (file: File | null) => void }) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return (
    <label htmlFor={id} className="min-h-16 cursor-pointer rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-left text-xs font-black text-emerald-950 shadow-sm transition hover:bg-emerald-50">
      <span className="block">{uploading ? 'กำลังอัปโหลด...' : label}</span>
      <span className="mt-1 block font-semibold text-emerald-700">แตะเพื่อเลือกไฟล์จากเครื่อง</span>
      <input
        id={id}
        type="file"
        accept={accept}
        disabled={uploading}
        className="sr-only"
        onChange={(event) => onFile(event.target.files?.[0] || null)}
      />
    </label>

  );
}

function UploadSummaryLine({ kind, item }: { kind: UploadKind; item?: MediaComposerUploadResponse }) {
  const label: Record<UploadKind, string> = {
    raw_video: 'Raw Video',
    voiceover_audio: 'Voiceover Audio',
    before_image: 'Before Image',
    after_image: 'After Image',
  };
  return (
    <div className="rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-emerald-100">
      <div className="font-black text-emerald-950">{label[kind]}</div>
      {item?.ok ? (
        <div className="mt-1 break-words text-emerald-800">
          upload_success · source_badge=uploaded_asset · {item.filename} · {item.public_media_url}
        </div>
      ) : (
        <div className="mt-1 text-slate-500">ยังไม่ได้อัปโหลด</div>
      )}
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
