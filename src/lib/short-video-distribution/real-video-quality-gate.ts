import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type RealVideoQualityGateDecision = 'passed' | 'needs_review' | 'blocked';

export type RealVideoQualityGateV2 = {
  real_video_quality_gate_v2: true;
  score_label: 'technical_video_score' | 'vision_score';
  master_video_url: string;
  local_video_path: string | null;
  ffprobe_performed: boolean;
  frames_extracted: boolean;
  audio_analyzed: boolean;
  vision_model_called: boolean;
  video_frames_analyzed: number;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  aspect_ratio: string | null;
  video_stream: boolean;
  audio_stream: boolean;
  audio: {
    has_audio: boolean;
    loudness_not_silent: boolean;
    duration_seconds: number | null;
    mean_volume_db: number | null;
    max_volume_db: number | null;
    clipping_risk: boolean;
  };
  extracted_frames: string[];
  quality_score: number;
  hook_score: number;
  visual_clarity_score: number;
  audio_quality_score: number;
  platform_fit_score: number;
  decision: RealVideoQualityGateDecision;
  recommendations: string[];
  errors: string[];
};

type FfprobeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
};

type FfprobePayload = {
  streams?: FfprobeStream[];
  format?: { duration?: string };
};

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function publicUrlToLocalPath(masterVideoUrl: string): string | null {
  const value = cleanText(masterVideoUrl);
  if (!value.startsWith('/')) return null;
  const normalized = path.normalize(value).replace(/^([/\\])+/, '');
  if (normalized.startsWith('..')) return null;
  return path.join(process.cwd(), 'public', normalized);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ratioLabel(width: number | null, height: number | null): string | null {
  if (!width || !height) return null;
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) < 0.03) return '9:16';
  return `${width}:${height}`;
}

function parseVolume(stderr: string): { mean: number | null; max: number | null } {
  const meanMatch = stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/i);
  const maxMatch = stderr.match(/max_volume:\s*(-?[0-9.]+) dB/i);
  return {
    mean: meanMatch ? Number(meanMatch[1]) : null,
    max: maxMatch ? Number(maxMatch[1]) : null,
  };
}

function runFfprobe(localPath: string): FfprobePayload {
  const output = execFileSync('ffprobe', [
    '-v', 'error',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    localPath,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return JSON.parse(output) as FfprobePayload;
}

function extractFrames(localPath: string, durationSeconds: number | null): string[] {
  const frameDir = mkdtempSync(path.join(tmpdir(), 'short-video-quality-v2-'));
  const middle = durationSeconds && durationSeconds > 0 ? Math.max(0, durationSeconds / 2) : 0;
  const timestamps = [0, 1, 3, middle];
  const framePaths: string[] = [];

  timestamps.forEach((timestamp, index) => {
    const framePath = path.join(frameDir, `frame_${index + 1}.jpg`);
    execFileSync('ffmpeg', [
      '-y',
      '-ss', String(timestamp),
      '-i', localPath,
      '-frames:v', '1',
      '-q:v', '3',
      framePath,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (existsSync(framePath) && statSync(framePath).size > 0) framePaths.push(framePath);
  });

  return framePaths;
}

function analyzeAudio(localPath: string, hasAudio: boolean): RealVideoQualityGateV2['audio'] {
  if (!hasAudio) {
    return { has_audio: false, loudness_not_silent: false, duration_seconds: null, mean_volume_db: null, max_volume_db: null, clipping_risk: false };
  }

  const result = spawnSync('ffmpeg', ['-i', localPath, '-af', 'volumedetect', '-f', 'null', '-'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const parsed = parseVolume(String(result.stderr || ''));
  const loudnessNotSilent = parsed.mean !== null ? parsed.mean > -50 : false;
  return {
    has_audio: true,
    loudness_not_silent: loudnessNotSilent,
    duration_seconds: null,
    mean_volume_db: parsed.mean,
    max_volume_db: parsed.max,
    clipping_risk: parsed.max !== null ? parsed.max > -1 : false,
  };
}

export function buildRealVideoQualityGateV2(masterVideoUrl: string): RealVideoQualityGateV2 {
  const errors: string[] = [];
  const localVideoPath = publicUrlToLocalPath(masterVideoUrl);
  const visionEnabled = process.env.SHORT_VIDEO_VISION_ANALYSIS_APPROVED === 'true';
  const base: RealVideoQualityGateV2 = {
    real_video_quality_gate_v2: true,
    score_label: visionEnabled ? 'vision_score' : 'technical_video_score',
    master_video_url: masterVideoUrl,
    local_video_path: localVideoPath,
    ffprobe_performed: false,
    frames_extracted: false,
    audio_analyzed: false,
    vision_model_called: false,
    video_frames_analyzed: 0,
    duration_seconds: null,
    width: null,
    height: null,
    aspect_ratio: null,
    video_stream: false,
    audio_stream: false,
    audio: { has_audio: false, loudness_not_silent: false, duration_seconds: null, mean_volume_db: null, max_volume_db: null, clipping_risk: false },
    extracted_frames: [],
    quality_score: 0,
    hook_score: 0,
    visual_clarity_score: 0,
    audio_quality_score: 0,
    platform_fit_score: 0,
    decision: 'blocked',
    recommendations: [],
    errors,
  };

  if (!localVideoPath || !existsSync(localVideoPath)) {
    errors.push('ไม่พบไฟล์วิดีโอ local สำหรับ ffprobe/ffmpeg จาก master_video_url นี้');
    base.recommendations.push('ใช้ master_video_url ที่เข้าถึงได้จาก public/ หรือเพิ่มขั้นตอนดาวน์โหลดไฟล์แบบปลอดภัยก่อนวิเคราะห์จริง');
    return base;
  }

  try {
    const probe = runFfprobe(localVideoPath);
    base.ffprobe_performed = true;
    const videoStream = (probe.streams || []).find((stream) => stream.codec_type === 'video');
    const audioStream = (probe.streams || []).find((stream) => stream.codec_type === 'audio');
    base.video_stream = Boolean(videoStream);
    base.audio_stream = Boolean(audioStream);
    base.width = videoStream?.width || null;
    base.height = videoStream?.height || null;
    base.duration_seconds = Number(probe.format?.duration || videoStream?.duration || 0) || null;
    base.aspect_ratio = ratioLabel(base.width, base.height);

    try {
      const frames = extractFrames(localVideoPath, base.duration_seconds);
      base.extracted_frames = frames;
      base.frames_extracted = frames.length > 0;
      base.video_frames_analyzed = frames.length;
    } catch (error) {
      errors.push(`ffmpeg frame extraction failed: ${error instanceof Error ? error.message : 'unknown_error'}`);
    }

    base.audio = analyzeAudio(localVideoPath, Boolean(audioStream));
    base.audio.duration_seconds = audioStream?.duration ? Number(audioStream.duration) : base.duration_seconds;
    base.audio_analyzed = true;

    const durationOk = Boolean(base.duration_seconds && base.duration_seconds > 0 && base.duration_seconds <= 90);
    const verticalOk = base.aspect_ratio === '9:16' || (base.width === 1080 && base.height === 1920);
    const framesOk = base.video_frames_analyzed >= 2;
    const audioOk = base.audio.has_audio && base.audio.loudness_not_silent && !base.audio.clipping_risk;

    base.hook_score = clampScore((durationOk ? 70 : 35) + (framesOk ? 20 : 0) + (base.duration_seconds && base.duration_seconds <= 15 ? 10 : 0));
    base.visual_clarity_score = clampScore((base.video_stream ? 45 : 0) + (verticalOk ? 35 : 10) + (framesOk ? 20 : 0));
    base.audio_quality_score = clampScore((base.audio.has_audio ? 35 : 0) + (base.audio.loudness_not_silent ? 45 : 0) + (!base.audio.clipping_risk ? 20 : 0));
    base.platform_fit_score = clampScore((verticalOk ? 45 : 0) + (durationOk ? 35 : 0) + (base.video_stream ? 20 : 0));
    base.quality_score = clampScore((base.hook_score + base.visual_clarity_score + base.audio_quality_score + base.platform_fit_score) / 4);
    base.decision = base.quality_score >= 80 ? 'passed' : base.quality_score >= 60 ? 'needs_review' : 'blocked';

    if (!visionEnabled) {
      base.vision_model_called = false;
      base.recommendations.push('Vision adapter ยังปิดอยู่: คะแนนนี้คือ technical_video_score จาก ffprobe/ffmpeg ไม่ใช่ vision score');
    }
    if (!verticalOk) base.recommendations.push('ปรับวิดีโอเป็นแนวตั้ง 9:16 ก่อนโพสต์ Short/Reels/TikTok');
    if (!durationOk) base.recommendations.push('ตรวจความยาววิดีโอให้อยู่ในช่วง short video ที่เหมาะสม');
    if (!audioOk) base.recommendations.push('ตรวจเสียง: ต้องมี audio ไม่เงียบ และไม่มี clipping risk');
    if (!base.recommendations.length) base.recommendations.push('ผ่าน technical gate เบื้องต้นจาก ffprobe/ffmpeg');
    return base;
  } catch (error) {
    errors.push(`ffprobe failed: ${error instanceof Error ? error.message : 'unknown_error'}`);
    base.recommendations.push('ติดตั้ง/ตรวจ ffprobe และตรวจไฟล์วิดีโอให้เปิดอ่านได้');
    return base;
  }
}

export function hasPassedRealVideoQualityGateV2(gate: RealVideoQualityGateV2 | null | undefined): boolean {
  return Boolean(gate?.real_video_quality_gate_v2 && gate.ffprobe_performed && gate.frames_extracted && gate.audio_analyzed && gate.decision === 'passed' && gate.quality_score >= 80);
}
