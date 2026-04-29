'use client';

import { useState, useEffect, Suspense } from 'react';
import { useProfile } from '@/context/profile-context';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { EmptyState } from '@/components/shared/empty-state';
import { OutputDisplay } from '@/components/content/output-display';
import { Sparkles, Loader2, Save, RefreshCw, Building2, X, Upload, Video } from 'lucide-react';
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
  meta?: {
    is_instagram?: boolean;
  };
}

const defaultInput: GenerationInput = {
  platform: 'facebook',
  platform_variant: 'post',
  content_type: 'promotion_post',
  tone: 'professional',
  language: 'th',
  post_length: 'medium',
};

const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm'];
const MIN_USABLE_TRANSCRIPT_LENGTH = 8;
const ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
];
const VIDEO_KEYFRAME_TIMESTAMPS = [0.2, 0.5, 0.8];

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

function normalizeTranscript(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function isUsableTranscript(value: string): boolean {
  return normalizeTranscript(value).length >= MIN_USABLE_TRANSCRIPT_LENGTH;
}

type VideoGenerationMode = 'keyframes_only' | 'keyframes_plus_transcript' | null;

interface VideoKeyframe {
  imageUrl: string;
  timestampSeconds: number;
  timestampLabel: string;
  percentLabel: string;
}

function readFileAsDataUrl(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable) return;
      const progress = Math.min(100, Math.round((event.loaded / event.total) * 100));
      onProgress(progress);
    };
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function waitForVideoEvent(
  video: HTMLVideoElement,
  eventName: 'loadedmetadata' | 'seeked',
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleResolve = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error(`Video ${eventName} failed`));
    };
    const cleanup = () => {
      video.removeEventListener(eventName, handleResolve);
      video.removeEventListener('error', handleError);
    };

    video.addEventListener(eventName, handleResolve, { once: true });
    video.addEventListener('error', handleError, { once: true });
  });
}

function formatVideoTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatUpdatedAtLabel(date: Date | null): string {
  if (!date) return '';

  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

function formatPercentLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

async function extractVideoKeyframes(videoSrc: string): Promise<VideoKeyframe[]> {
  const video = document.createElement('video');
  video.src = videoSrc;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  await waitForVideoEvent(video, 'loadedmetadata');

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
  const canvas = document.createElement('canvas');
  const width = video.videoWidth || 640;
  const height = video.videoHeight || 360;
  const maxWidth = 960;
  const ratio = width > maxWidth ? maxWidth / width : 1;
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Unable to prepare canvas for video frame extraction');
  }

  const frames: VideoKeyframe[] = [];
  for (const timestampRatio of VIDEO_KEYFRAME_TIMESTAMPS) {
    const targetTime = Math.min(Math.max(duration * timestampRatio, 0), Math.max(duration - 0.05, 0));
    video.currentTime = targetTime;
    await waitForVideoEvent(video, 'seeked');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({
      imageUrl: canvas.toDataURL('image/jpeg', 0.82),
      timestampSeconds: targetTime,
      timestampLabel: formatVideoTimestamp(targetTime),
      percentLabel: formatPercentLabel(timestampRatio),
    });
  }

  return frames;
}

function GeneratePageInner() {
  const searchParams = useSearchParams();
  const [input, setInput] = useState<GenerationInput>(() => {
    const platform = searchParams.get('platform') as Platform || 'facebook';
    const contentType = searchParams.get('type') as ContentType || 'promotion_post';
    return { ...defaultInput, platform, content_type: contentType };
  });
  const { profile, loading: profileLoading } = useProfile();
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ content: GeneratedContent; output: ContentOutput } | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [socialPages, setSocialPages] = useState<SocialPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadError, setVideoUploadError] = useState('');
  const [videoUploading, setVideoUploading] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
  const [videoKeyframes, setVideoKeyframes] = useState<VideoKeyframe[]>([]);
  const [extractingKeyframes, setExtractingKeyframes] = useState(false);
  const [transcribingVideo, setTranscribingVideo] = useState(false);
  const [videoTranscriptError, setVideoTranscriptError] = useState('');
  const [videoTranscript, setVideoTranscript] = useState('');
  const [videoAnalysisSummary, setVideoAnalysisSummary] = useState('');
  const [videoAnalysisError, setVideoAnalysisError] = useState('');
  const [useTranscriptForGeneration, setUseTranscriptForGeneration] = useState(true);
  const [generationVideoMode, setGenerationVideoMode] = useState<VideoGenerationMode>(null);
  const [videoAnalysisUpdatedAt, setVideoAnalysisUpdatedAt] = useState<Date | null>(null);
  const [videoTranscriptUpdatedAt, setVideoTranscriptUpdatedAt] = useState<Date | null>(null);
  const [generationAnalysisUsedAt, setGenerationAnalysisUsedAt] = useState<Date | null>(null);

  const normalizedTranscript = normalizeTranscript(videoTranscript);
  const hasTranscriptText = normalizedTranscript.length > 0;
  const hasUsableTranscript = isUsableTranscript(videoTranscript);
  const shouldUseTranscriptForGeneration = useTranscriptForGeneration && hasUsableTranscript;
  const transcriptStatusText = transcribingVideo
    ? 'กำลังถอดเสียงอัตโนมัติ...'
    : hasUsableTranscript
      ? 'มี transcript อัตโนมัติ'
      : hasTranscriptText
        ? 'เสียงไม่ชัด ใช้ key frames อย่างเดียว'
        : 'ใช้ key frames อย่างเดียว';

  useEffect(() => {
    loadSocialPages();
  }, []);

  useEffect(() => {
    if (profile?.id) {
      loadCampaigns(profile.id);
    }
  }, [profile?.id]);

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

  async function loadCampaigns(pid: string) {
    try {
      const campRes = await fetch(`/api/campaigns?profile_id=${pid}`);
      const camps = await campRes.json();
      if (Array.isArray(camps)) setCampaigns(camps);
    } catch (err) {
      console.error('Failed to load campaigns', err);
    }
  }

  async function analyzeVideoFrames(keyframes: VideoKeyframe[]): Promise<string> {
    const visionRes = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_urls: keyframes.map((frame) => frame.imageUrl),
        context_type: 'video',
      }),
    });

    if (!visionRes.ok) {
      const errorData = await visionRes.json().catch(() => ({}));
      throw new Error(errorData.error || 'Video analysis failed');
    }

    const visionData = await visionRes.json();
    return visionData.analysis || '';
  }

  async function transcribeVideoFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('video', file);
    const transcriptionRes = await fetch('/api/transcribe-video', {
      method: 'POST',
      body: formData,
    });

    if (!transcriptionRes.ok) {
      const errorData = await transcriptionRes.json().catch(() => ({}));
      throw new Error(errorData.error || 'Auto transcription failed');
    }

    const transcriptionData = await transcriptionRes.json();
    return transcriptionData.transcript || '';
  }

  async function handleRefreshKeyframes() {
    if (!videoPreview) return;

    setExtractingKeyframes(true);
    setAnalyzingVideo(true);
    setVideoAnalysisError('');

    try {
      const frames = await extractVideoKeyframes(videoPreview);
      setVideoKeyframes(frames);
      const analysis = await analyzeVideoFrames(frames);
      setVideoAnalysisSummary(analysis);
      setVideoAnalysisUpdatedAt(new Date());
      toast.success('วิเคราะห์ key frames ใหม่เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Keyframe refresh failed', error);
      setVideoAnalysisSummary('');
      setVideoAnalysisError('วิเคราะห์ key frames ใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง');
      toast.error('วิเคราะห์ key frames ใหม่ไม่สำเร็จ');
    } finally {
      setExtractingKeyframes(false);
      setAnalyzingVideo(false);
    }
  }

  async function handleRefreshTranscript() {
    if (!videoFile) return;

    setTranscribingVideo(true);
    setVideoTranscriptError('');
    try {
      const transcript = await transcribeVideoFile(videoFile);
      setVideoTranscript(transcript);
      setVideoTranscriptUpdatedAt(new Date());
      if (transcript && !isUsableTranscript(transcript)) {
        setVideoTranscriptError('เสียงในคลิปสั้นหรือไม่ชัดพอ ระบบจะใช้ key frames จากวิดีโอเป็นหลักในการสร้างคอนเทนต์');
        setUseTranscriptForGeneration(false);
      } else {
        setUseTranscriptForGeneration(true);
      }
      toast.success('ถอด transcript ใหม่เรียบร้อยแล้ว');
    } catch (error) {
      console.error('Transcript refresh failed', error);
      setVideoTranscriptError('ถอดเสียงอัตโนมัติไม่สำเร็จ คุณยังพิมพ์โน้ตหรือคำพูดจากวิดีโอเองได้');
      setUseTranscriptForGeneration(false);
      toast.error('ถอด transcript ใหม่ไม่สำเร็จ');
    } finally {
      setTranscribingVideo(false);
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      if (videoFile) {
        setVideoUploadError('กรุณาลบวิดีโอก่อน แล้วค่อยอัปโหลดรูปภาพ');
        toast.error('กรุณาลบวิดีโอก่อน แล้วค่อยอัปโหลดรูปภาพ');
        return;
      }

      if (imageFiles.length + files.length > 2) {
        toast.error('อัพโหลดได้สูงสุด 2 รูปภาพครับ');
        return;
      }

      const newFiles = [...imageFiles, ...files].slice(0, 2);
      setImageFiles(newFiles);

      Promise.all(newFiles.map((file) => readFileAsDataUrl(file)))
        .then((previews) => setImagePreviews(previews))
        .catch(() => toast.error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
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

  async function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setVideoUploadError('');
    setVideoUploadProgress(0);
    setVideoKeyframes([]);
    setVideoTranscript('');
    setVideoTranscriptError('');
    setVideoAnalysisSummary('');
    setVideoAnalysisError('');
    setExtractingKeyframes(false);
    setTranscribingVideo(false);
    setUseTranscriptForGeneration(true);
    setGenerationVideoMode(null);
    setVideoAnalysisUpdatedAt(null);
    setVideoTranscriptUpdatedAt(null);
    setGenerationAnalysisUsedAt(null);

    if (imageFiles.length > 0) {
      setVideoUploadError('กรุณาลบรูปภาพก่อน แล้วค่อยอัปโหลดวิดีโอ');
      toast.error('กรุณาลบรูปภาพก่อน แล้วค่อยอัปโหลดวิดีโอ');
      return;
    }

    const extension = getFileExtension(file.name);
    if (!ALLOWED_VIDEO_EXTENSIONS.includes(extension)) {
      const message = `ไฟล์ .${extension || 'unknown'} ยังไม่รองรับ รองรับเฉพาะ ${ALLOWED_VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(', ')}`;
      setVideoUploadError(message);
      toast.error(message);
      return;
    }

    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.type)) {
      const message = `MIME type "${file.type || 'unknown'}" ยังไม่รองรับ`;
      setVideoUploadError(message);
      toast.error(message);
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const message = `วิดีโอต้องมีขนาดไม่เกิน ${formatBytes(MAX_VIDEO_SIZE_BYTES)} ตอนนี้คือ ${formatBytes(file.size)}`;
      setVideoUploadError(message);
      toast.error(message);
      return;
    }

    try {
      setVideoUploading(true);
      const preview = await readFileAsDataUrl(file, setVideoUploadProgress);
      setVideoFile(file);
      setVideoPreview(preview);
      setVideoUploadProgress(100);

      setExtractingKeyframes(true);
      setVideoTranscriptError('');
      try {
        const frames = await extractVideoKeyframes(preview);
        setVideoKeyframes(frames);
        setAnalyzingVideo(true);
        setVideoAnalysisError('');
        try {
          const analysis = await analyzeVideoFrames(frames);
          setVideoAnalysisSummary(analysis);
          setVideoAnalysisUpdatedAt(new Date());
        } catch (error) {
          console.error('Video analysis preview failed', error);
          setVideoAnalysisSummary('');
          setVideoAnalysisError('สรุปภาพจากวิดีโอล่วงหน้าไม่สำเร็จ แต่ยังสร้างคอนเทนต์จาก key frames ได้ตอน generate');
        } finally {
          setAnalyzingVideo(false);
        }
      } catch (error) {
        console.error('Keyframe extraction failed', error);
        setVideoKeyframes([]);
        toast.error('สร้าง key frames จากวิดีโอไม่สำเร็จ');
      } finally {
        setExtractingKeyframes(false);
      }

      setTranscribingVideo(true);
      try {
        const transcript = await transcribeVideoFile(file);
        setVideoTranscript(transcript);
        setVideoTranscriptUpdatedAt(new Date());
        if (transcript && !isUsableTranscript(transcript)) {
          setVideoTranscriptError('เสียงในคลิปสั้นหรือไม่ชัดพอ ระบบจะใช้ key frames จากวิดีโอเป็นหลักในการสร้างคอนเทนต์');
          setUseTranscriptForGeneration(false);
        } else {
          setUseTranscriptForGeneration(true);
        }
      } catch (error) {
        console.error('Video transcription failed', error);
        setVideoTranscriptError('ถอดเสียงอัตโนมัติไม่สำเร็จ คุณยังพิมพ์โน้ตหรือคำพูดจากวิดีโอเองได้');
        setUseTranscriptForGeneration(false);
      } finally {
        setTranscribingVideo(false);
      }
    } catch {
      setVideoUploadError('ไม่สามารถอ่านไฟล์วิดีโอได้ กรุณาลองไฟล์ใหม่อีกครั้ง');
      toast.error('ไม่สามารถอ่านไฟล์วิดีโอได้');
    } finally {
      setVideoUploading(false);
    }
  }

  function removeVideo() {
    setVideoFile(null);
    setVideoPreview('');
    setVideoUploadProgress(0);
    setVideoUploadError('');
    setVideoUploading(false);
    setAnalyzingVideo(false);
    setExtractingKeyframes(false);
    setTranscribingVideo(false);
    setVideoKeyframes([]);
    setVideoTranscriptError('');
    setVideoTranscript('');
    setVideoAnalysisSummary('');
    setVideoAnalysisError('');
    setUseTranscriptForGeneration(true);
    setGenerationVideoMode(null);
    setVideoAnalysisUpdatedAt(null);
    setVideoTranscriptUpdatedAt(null);
    setGenerationAnalysisUsedAt(null);
  }

  async function handleGenerate() {
    if (!profile?.id) {
      toast.error('Please create a business profile first');
      return;
    }

    setGenerating(true);
    setResult(null);

    try {
      let image_analysis = '';
      let video_analysis = '';

      if (imageFiles.length > 0) {
        setAnalyzingImage(true);
        try {
          const visionRes = await fetch('/api/vision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image_urls: imagePreviews, context_type: 'image' }),
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

      if (videoPreview) {
        setAnalyzingVideo(true);
        setVideoAnalysisError('');
        try {
          const keyframes = videoKeyframes.length > 0 ? videoKeyframes : await extractVideoKeyframes(videoPreview);
          video_analysis = await analyzeVideoFrames(keyframes);
          setVideoAnalysisSummary(video_analysis);
          const analysisUsedAt = new Date();
          setVideoAnalysisUpdatedAt(analysisUsedAt);
          setGenerationAnalysisUsedAt(analysisUsedAt);
        } catch (err) {
          console.error('Video analysis failed', err);
          setVideoAnalysisSummary('');
          setVideoAnalysisError('สรุปภาพจากวิดีโอไม่สำเร็จ ระบบจะอิงจากข้อมูลที่กรอกและ key frames เท่าที่มีแทน');
          setGenerationAnalysisUsedAt(null);
          toast.error('วิเคราะห์วิดีโอไม่สำเร็จ ระบบจะสร้างคอนเทนต์โดยอิงจากข้อมูลที่กรอกแทน');
        } finally {
          setAnalyzingVideo(false);
        }
      } else {
        setGenerationAnalysisUsedAt(null);
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_profile_id: profile.id,
          project_id: selectedCampaign || undefined,
          input: {
            ...input,
            image_analysis: image_analysis || undefined,
            video_analysis: video_analysis || undefined,
            video_transcript: shouldUseTranscriptForGeneration ? normalizedTranscript : undefined,
            image_urls: imagePreviews.length > 0 ? imagePreviews : undefined,
            video_url: videoPreview || undefined,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();
      setGenerationVideoMode(
        videoPreview
          ? shouldUseTranscriptForGeneration
            ? 'keyframes_plus_transcript'
            : 'keyframes_only'
          : null,
      );
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

  if (!profile?.id) {
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
                        disabled={!!videoFile}
                        onChange={handleImageChange} 
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-gray-700 font-medium">อัปโหลดวิดีโอสำหรับโพสต์จริง</Label>
                  <span className="text-xs text-gray-400">{videoFile ? '1/1 วิดีโอ' : 'ยังไม่มีวิดีโอ'}</span>
                </div>

                {videoPreview ? (
                  <div className="relative rounded-2xl overflow-hidden border border-gray-200 bg-black/90 shadow-sm">
                    <video src={videoPreview} controls className="w-full max-h-64 bg-black" />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 rounded-full drop-shadow-md"
                      onClick={removeVideo}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="px-4 py-3 bg-white">
                      <p className="text-sm font-medium text-gray-700">{videoFile?.name}</p>
                      <p className="text-xs text-gray-400">รองรับโพสต์ Facebook Video และ Instagram Reel ใน flow นี้</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-gray-500">
                          <span>{videoUploading ? 'กำลังเตรียมไฟล์วิดีโอ...' : 'ไฟล์พร้อมใช้งาน'}</span>
                          <span>{videoUploadProgress}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full transition-all ${videoUploadError ? 'bg-red-500' : 'bg-indigo-500'}`}
                            style={{ width: `${videoUploadProgress}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                          <span>ขนาด {videoFile ? formatBytes(videoFile.size) : '-'}</span>
                          <span>MIME {videoFile?.type || '-'}</span>
                          <span>นามสกุล .{videoFile ? getFileExtension(videoFile.name) : '-'}</span>
                          <span>{extractingKeyframes ? 'กำลังดึง key frames' : 'พร้อม preview key frames'}</span>
                          <span>{transcriptStatusText}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer p-6 ${
                      imageFiles.length > 0
                        ? 'border-gray-200 bg-gray-50/60 text-gray-400 cursor-not-allowed'
                        : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-indigo-400'
                    }`}
                    onClick={() => {
                      if (!imageFiles.length) {
                        document.getElementById('video-upload')?.click();
                      }
                    }}
                  >
                    <div className="rounded-full bg-indigo-50 flex items-center justify-center mb-2 p-3">
                      <Video className="h-5 w-5 text-indigo-600" />
                    </div>
                    <span className="text-sm font-medium text-gray-600 text-center">
                      {videoUploading ? 'กำลังอ่านไฟล์วิดีโอ...' : 'เพิ่มวิดีโอ 1 ไฟล์'}
                    </span>
                    <span className="text-xs text-gray-400 text-center mt-1">
                      รองรับ {ALLOWED_VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(', ')} และขนาดไม่เกิน {formatBytes(MAX_VIDEO_SIZE_BYTES)}
                    </span>
                    <div className="mt-4 w-full max-w-sm space-y-2">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full transition-all ${videoUploadError ? 'bg-red-500' : 'bg-indigo-500'}`}
                          style={{ width: `${videoUploadProgress}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{videoUploadError ? 'พบปัญหาก่อนอัปโหลด' : videoUploading ? 'กำลังเตรียม preview' : 'Preflight validation ก่อนส่งจริง'}</span>
                        <span>{videoUploadProgress}%</span>
                      </div>
                    </div>
                    <input
                      id="video-upload"
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={imageFiles.length > 0}
                      onChange={handleVideoChange}
                    />
                  </div>
                )}

                {videoUploadError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {videoUploadError}
                  </div>
                )}

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3 space-y-2">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Preflight Validation</p>
                  <div className="text-xs text-indigo-900 space-y-1">
                    <p>MIME ที่รองรับ: {ALLOWED_VIDEO_MIME_TYPES.join(', ')}</p>
                    <p>Extension ที่รองรับ: {ALLOWED_VIDEO_EXTENSIONS.map((ext) => `.${ext}`).join(', ')}</p>
                    <p>ขนาดสูงสุดใน UI ตอนนี้: {formatBytes(MAX_VIDEO_SIZE_BYTES)}</p>
                  </div>
                  <div className="text-[11px] text-indigo-800 leading-relaxed">
                    Production note: ควรแยก bucket สำหรับวิดีโอด้วย `SUPABASE_CONTENT_VIDEO_BUCKET`, เปิด public read หรือ signed delivery ให้ Meta ดึงไฟล์ได้, และตั้ง bucket image เดิมผ่าน `SUPABASE_CONTENT_IMAGE_BUCKET` เพื่อไม่ปน media type ใน production
                  </div>
                </div>

                {videoPreview && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-gray-700 font-medium">ตัวอย่าง Key Frames จากวิดีโอ</Label>
                      <span className="text-xs text-gray-400">
                        {extractingKeyframes ? 'กำลังเตรียม...' : `${videoKeyframes.length}/${VIDEO_KEYFRAME_TIMESTAMPS.length} เฟรม`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {videoKeyframes.map((frame, index) => (
                        <div key={index} className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                          <img src={frame.imageUrl} alt={`Video keyframe ${index + 1}`} className="h-24 w-full object-cover" />
                          <div className="px-2 py-1 text-[11px] text-gray-500 flex items-center justify-between gap-2">
                            <span>Scene {index + 1}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">{frame.percentLabel}</span>
                              <span className="font-medium text-gray-600">{frame.timestampLabel}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                      {extractingKeyframes && videoKeyframes.length === 0 && (
                        <>
                          {VIDEO_KEYFRAME_TIMESTAMPS.map((_, index) => (
                            <div key={index} className="rounded-xl border border-dashed border-gray-200 bg-gray-50 h-32 flex items-center justify-center text-xs text-gray-400">
                              เตรียมเฟรม {index + 1}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label className="text-gray-700 font-medium">บทพูดหรือโน้ตจากวิดีโอ</Label>
                    <div className="flex items-center gap-2">
                      {videoTranscriptUpdatedAt && (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          transcript updated {formatUpdatedAtLabel(videoTranscriptUpdatedAt)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {transcribingVideo
                          ? 'กำลังถอดเสียงอัตโนมัติ...'
                          : hasUsableTranscript
                            ? 'ระบบถอดเสียงแล้ว แก้ไขต่อได้'
                            : hasTranscriptText
                              ? 'ข้อความสั้นเกินใช้ ระบบจะพึ่ง key frames เป็นหลัก'
                              : 'ใส่เพิ่มเองได้ถ้าต้องการ'}
                      </span>
                    </div>
                  </div>
                  <Textarea
                    value={videoTranscript}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      const usable = isUsableTranscript(nextValue);
                      setVideoTranscript(nextValue);
                      if (usable) {
                        setVideoTranscriptError('');
                        setUseTranscriptForGeneration(true);
                      } else if (normalizeTranscript(nextValue).length > 0) {
                        setVideoTranscriptError('ข้อความใน transcript ยังสั้นเกินใช้ ระบบจะใช้ key frames จากวิดีโอเป็นหลัก');
                        setUseTranscriptForGeneration(false);
                      } else {
                        setVideoTranscriptError('');
                        setUseTranscriptForGeneration(false);
                      }
                    }}
                    placeholder="ระบบจะพยายามถอดเสียงอัตโนมัติให้ ถ้าต้องการเติมบริบท เช่น ช่างกำลังล้างคอยล์เย็น, มีคราบสกปรก, ก่อน-หลังล้างต่างกันอย่างไร สามารถแก้ไขหรือเติมเองได้"
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshTranscript}
                      disabled={!videoFile || transcribingVideo}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${transcribingVideo ? 'animate-spin' : ''}`} />
                      วิเคราะห์ transcript ใหม่
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshKeyframes}
                      disabled={!videoPreview || extractingKeyframes || analyzingVideo}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${(extractingKeyframes || analyzingVideo) ? 'animate-spin' : ''}`} />
                      วิเคราะห์ key frames ใหม่
                    </Button>
                  </div>
                  <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-700">ใช้ transcript นี้ในการเขียน</p>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {hasUsableTranscript
                          ? 'เปิดไว้เพื่อให้ AI ใช้เสียง/คำพูดจากคลิปร่วมกับ key frames'
                          : 'ตอนนี้ transcript ยังไม่พร้อมใช้งาน ระบบจะสร้างคอนเทนต์จาก key frames เป็นหลัก'}
                      </p>
                    </div>
                    <Switch
                      checked={shouldUseTranscriptForGeneration}
                      disabled={!hasUsableTranscript}
                      onCheckedChange={(checked) => setUseTranscriptForGeneration(checked)}
                      aria-label="Use transcript for generation"
                    />
                  </div>
                  {videoTranscriptError && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      {videoTranscriptError}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 leading-relaxed">
                    ถ้าไม่มี transcript ระบบจะยังใช้ภาพ key frames จากวิดีโอในการสรุปบริบทให้ก่อนสร้างคอนเทนต์
                  </p>
                </div>

                {videoPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-gray-700 font-medium">Video Analysis Summary</Label>
                      <div className="flex items-center gap-2">
                        {videoAnalysisUpdatedAt && (
                          <span className="inline-flex items-center rounded-full border border-blue-200 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            analysis updated {formatUpdatedAtLabel(videoAnalysisUpdatedAt)}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {analyzingVideo
                            ? 'กำลังสรุปจาก key frames...'
                            : videoAnalysisSummary
                              ? 'พร้อมใช้ใน generation'
                              : 'จะสรุปอัตโนมัติเมื่อกด generate'}
                        </span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
                      {analyzingVideo ? (
                        <div className="flex items-center gap-2 text-sm text-blue-800">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          กำลังวิเคราะห์สิ่งที่เกิดขึ้นในคลิปจาก key frames...
                        </div>
                      ) : videoAnalysisSummary ? (
                        <p className="text-sm leading-relaxed text-blue-950 whitespace-pre-wrap">
                          {videoAnalysisSummary}
                        </p>
                      ) : (
                        <p className="text-sm leading-relaxed text-blue-800">
                          ระบบจะสรุปว่าคลิปกำลังทำอะไร, มีเครื่องมือหรือปัญหาอะไร, และมุมการตลาดที่ตรงกับภาพจริงก่อนสร้างคอนเทนต์
                        </p>
                      )}
                    </div>
                    {videoAnalysisError && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        {videoAnalysisError}
                      </div>
                    )}
                  </div>
                )}
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
                      const selectedPlatform = page.meta?.is_instagram
                        ? 'instagram'
                        : page.provider;
                      updateInput('platform', selectedPlatform as Platform);
                    }
                  }}
                >
                  <option value="">-- เลือกเพจที่ต้องการโพสต์ --</option>
                  {socialPages.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{(p.meta?.is_instagram ? 'INSTAGRAM' : p.provider).toUpperCase()}] {p.name}
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
            disabled={generating || extractingKeyframes || transcribingVideo}
          >
            {generating || extractingKeyframes || transcribingVideo ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                {generating
                  ? 'กำลังสร้างคอนเทนต์...'
                  : extractingKeyframes
                    ? 'กำลังเตรียม key frames...'
                    : 'กำลังถอดเสียงอัตโนมัติ...'}
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
            <Card className="bg-white/80 backdrop-blur-lg border border-white/40 shadow-xl rounded-2xl overflow-hidden animate-pulse">
              <CardContent className="p-6 space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-32 rounded-full" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <div className="pt-6 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
                <div className="pt-4">
                  <Skeleton className="h-10 w-full rounded-button" />
                </div>
                <div className="text-center pt-4">
                  <p className="text-xs text-blue-600 animate-bounce font-medium">AI กำลังร่างคอนเทนต์และจัดรูปแบบตามหลัก SEO ให้คุณ...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {result && !generating && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  {generationVideoMode === 'keyframes_only' && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                      ใช้ข้อมูลวิดีโอ: key frames only
                    </span>
                  )}
                  {generationVideoMode === 'keyframes_plus_transcript' && (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                      ใช้ข้อมูลวิดีโอ: key frames + transcript
                    </span>
                  )}
                  {generationAnalysisUsedAt && (
                    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
                      ล่าสุดใช้ analysis เวลา {formatUpdatedAtLabel(generationAnalysisUsedAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={handleGenerate}>
                  <RefreshCw className="h-3 w-3 mr-1" /> สร้างใหม่
                </Button>
                <Button size="sm" onClick={handleSave}>
                  <Save className="h-3 w-3 mr-1" /> บันทึก
                </Button>
                </div>
              </div>
              <OutputDisplay
                output={result.output}
                platform={input.platform}
                contentId={result.content?.id}
                imageUrls={imagePreviews}
                videoUrl={videoPreview || undefined}
              />
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
