import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdtempSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  findProductVideoUploadedAsset,
  isSafeProductVideoAssetId,
  PRODUCT_VIDEO_UPLOAD_DIR,
  type ProductVideoUploadedAssetMetadata,
} from '@/lib/product-video-assets';

export type RealVideoQualityGateDecision = 'passed' | 'needs_review' | 'blocked';
export type RealVideoAssetResolverSource = 'explicit_video_asset_id' | 'explicit_source_id' | 'asset_route_url' | 'local_public_path' | 'blocked';
export type RealVideoAssetResolverError =
  | 'missing_asset_reference'
  | 'external_url_not_allowed'
  | 'malformed_asset_url'
  | 'unsafe_asset_id'
  | 'asset_metadata_not_found'
  | 'asset_media_type_not_video'
  | 'asset_path_missing'
  | 'asset_path_not_regular_file'
  | 'asset_path_outside_root'
  | 'asset_path_not_readable'
  | 'local_public_path_not_found'
  | 'local_public_path_traversal'
  | 'analysis_failed';

export type RealVideoQualityGateV2 = {
  real_video_quality_gate_v2: true;
  score_label: 'technical_video_score' | 'vision_score';
  score_kind: 'technical_video_score' | 'vision_score';
  analysis_timestamp: string;
  master_video_url: string;
  local_video_path: string | null;
  asset_resolver_source: RealVideoAssetResolverSource;
  resolved_asset_id: string | null;
  analyzed_asset_id: string | null;
  raw_video_asset_id: string | null;
  final_master_video_asset_id: string | null;
  asset_role: 'final_master_video' | 'raw_video' | 'unknown';
  audio_expectation: 'required' | 'optional';
  ready_for_publish: boolean;
  video_sha256_prefix: string | null;
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
  video_codec: string | null;
  audio_codec: string | null;
  audio_sample_rate: number | null;
  audio_channels: number | null;
  audio: {
    has_audio: boolean;
    loudness_not_silent: boolean;
    duration_seconds: number | null;
    mean_volume_db: number | null;
    max_volume_db: number | null;
    integrated_loudness_lufs: number | null;
    true_peak_dbtp: number | null;
    opening_silence: boolean;
    clipping_risk: boolean;
  };
  extracted_frames: string[];
  frame_timestamps_seconds: number[];
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
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  sample_rate?: string;
  channels?: number;
};

type FfprobePayload = {
  streams?: FfprobeStream[];
  format?: { duration?: string };
};

type BuildGateOptions = {
  video_asset_id?: string | null;
  source_id?: string | null;
  raw_video_asset_id?: string | null;
  final_master_video_asset_id?: string | null;
  audio_expectation?: 'required' | 'optional' | string | null;
};

type SafeResolvedVideoAsset = {
  ok: true;
  source: RealVideoAssetResolverSource;
  assetId: string | null;
  safeDisplayPath: string;
  canonicalPath: string;
  metadata: ProductVideoUploadedAssetMetadata | null;
} | {
  ok: false;
  source: RealVideoAssetResolverSource;
  error: RealVideoAssetResolverError;
};

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
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

function roundSeconds(value: number): number {
  return Math.max(0, Number(value.toFixed(3)));
}

export function parseProductVideoAssetIdFromTrustedRoute(value: string): string | null {
  const text = cleanText(value);
  if (!text) return null;
  let parsed: URL;
  try {
    parsed = new URL(text, 'http://localhost');
  } catch {
    return null;
  }
  const prefix = '/api/product-video/assets/';
  if (!parsed.pathname.startsWith(prefix)) return null;
  const remainder = parsed.pathname.slice(prefix.length);
  if (!remainder || remainder.includes('/')) return null;
  let decoded = '';
  try {
    decoded = decodeURIComponent(remainder).trim();
  } catch {
    return null;
  }
  if (!isSafeProductVideoAssetId(decoded)) return null;
  return decoded;
}

function resolveLocalPublicPath(masterVideoUrl: string): SafeResolvedVideoAsset {
  const value = cleanText(masterVideoUrl);
  if (!value.startsWith('/')) return { ok: false, source: 'blocked', error: 'external_url_not_allowed' };
  const normalized = path.normalize(value).replace(/^([/\\])+/, '');
  if (normalized.startsWith('..')) return { ok: false, source: 'local_public_path', error: 'local_public_path_traversal' };
  const candidate = path.join(process.cwd(), 'public', normalized);
  if (!existsSync(candidate)) return { ok: false, source: 'local_public_path', error: 'local_public_path_not_found' };
  try {
    const canonicalPath = realpathSync(candidate);
    const publicRoot = realpathSync(path.join(process.cwd(), 'public'));
    if (canonicalPath !== publicRoot && !canonicalPath.startsWith(publicRoot + path.sep)) {
      return { ok: false, source: 'local_public_path', error: 'asset_path_outside_root' };
    }
    const stats = statSync(canonicalPath);
    if (!stats.isFile()) return { ok: false, source: 'local_public_path', error: 'asset_path_not_regular_file' };
    accessSync(canonicalPath, constants.R_OK);
    return { ok: true, source: 'local_public_path', assetId: null, safeDisplayPath: value, canonicalPath, metadata: null };
  } catch {
    return { ok: false, source: 'local_public_path', error: 'asset_path_not_readable' };
  }
}

async function validateUploadedAssetPath(metadata: ProductVideoUploadedAssetMetadata): Promise<SafeResolvedVideoAsset> {
  if (metadata.media_type !== 'video' || !metadata.mime_type.startsWith('video/')) {
    return { ok: false, source: 'asset_route_url', error: 'asset_media_type_not_video' };
  }
  const localAssetPath = cleanText(metadata.local_asset_path);
  if (!localAssetPath) return { ok: false, source: 'asset_route_url', error: 'asset_path_missing' };
  try {
    const root = realpathSync(PRODUCT_VIDEO_UPLOAD_DIR);
    const canonicalPath = realpathSync(localAssetPath);
    if (canonicalPath !== root && !canonicalPath.startsWith(root + path.sep)) {
      return { ok: false, source: 'asset_route_url', error: 'asset_path_outside_root' };
    }
    const stats = statSync(canonicalPath);
    if (!stats.isFile()) return { ok: false, source: 'asset_route_url', error: 'asset_path_not_regular_file' };
    accessSync(canonicalPath, constants.R_OK);
    return {
      ok: true,
      source: 'asset_route_url',
      assetId: metadata.asset_id,
      safeDisplayPath: `uploaded_asset:${metadata.asset_id.slice(0, 8)}`,
      canonicalPath,
      metadata,
    };
  } catch {
    return { ok: false, source: 'asset_route_url', error: 'asset_path_not_readable' };
  }
}

async function resolveUploadedAsset(assetId: string, source: RealVideoAssetResolverSource): Promise<SafeResolvedVideoAsset> {
  if (!isSafeProductVideoAssetId(assetId)) return { ok: false, source, error: 'unsafe_asset_id' };
  const metadata = await findProductVideoUploadedAsset(assetId);
  if (!metadata) return { ok: false, source, error: 'asset_metadata_not_found' };
  const resolved = await validateUploadedAssetPath(metadata);
  return resolved.ok ? { ...resolved, source } : { ...resolved, source };
}

async function resolveTrustedVideoAsset(masterVideoUrl: string, options: BuildGateOptions = {}): Promise<SafeResolvedVideoAsset> {
  const explicitFinalMasterId = cleanText(options.final_master_video_asset_id);
  if (explicitFinalMasterId) return resolveUploadedAsset(explicitFinalMasterId, 'explicit_video_asset_id');

  const explicitAssetId = cleanText(options.video_asset_id);
  if (explicitAssetId) return resolveUploadedAsset(explicitAssetId, 'explicit_video_asset_id');

  const sourceId = cleanText(options.source_id);
  if (sourceId && isSafeProductVideoAssetId(sourceId)) {
    const resolved = await resolveUploadedAsset(sourceId, 'explicit_source_id');
    if (resolved.ok || resolved.error !== 'asset_metadata_not_found') return resolved;
  }

  const routeAssetId = parseProductVideoAssetIdFromTrustedRoute(masterVideoUrl);
  if (routeAssetId) return resolveUploadedAsset(routeAssetId, 'asset_route_url');

  const text = cleanText(masterVideoUrl);
  if (/^https?:\/\//i.test(text)) return { ok: false, source: 'blocked', error: 'external_url_not_allowed' };
  if (text.includes('/api/product-video/assets/')) return { ok: false, source: 'blocked', error: 'malformed_asset_url' };
  if (text.startsWith('/')) return resolveLocalPublicPath(text);
  return { ok: false, source: 'blocked', error: 'missing_asset_reference' };
}

function parseVolume(stderr: string): { mean: number | null; max: number | null } {
  const meanMatch = stderr.match(/mean_volume:\s*(-?[0-9.]+) dB/i);
  const maxMatch = stderr.match(/max_volume:\s*(-?[0-9.]+) dB/i);
  return {
    mean: meanMatch ? Number(meanMatch[1]) : null,
    max: maxMatch ? Number(maxMatch[1]) : null,
  };
}

function parseIntegratedLoudness(stderr: string): number | null {
  const summary = stderr.match(/I:\s*(-?[0-9.]+)\s*LUFS/i);
  return summary ? Number(summary[1]) : null;
}

function detectsOpeningSilence(stderr: string): boolean {
  const firstSilenceStart = stderr.match(/silence_start:\s*([0-9.]+)/i);
  if (!firstSilenceStart) return false;
  const start = Number(firstSilenceStart[1]);
  return Number.isFinite(start) && start <= 0.15;
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

export function buildFrameTimestamps(durationSeconds: number | null): number[] {
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : 0;
  const maxTimestamp = duration > 0.15 ? Math.max(0, duration - 0.05) : 0;
  const middle = duration > 0 ? duration / 2 : 0;
  const candidates = [0, 1, 3, middle]
    .map((timestamp) => roundSeconds(Math.min(Math.max(0, timestamp), maxTimestamp)));
  return [...new Set(candidates)];
}

function extractFrames(localPath: string, durationSeconds: number | null): { labels: string[]; timestamps: number[] } {
  const frameDir = mkdtempSync(path.join(tmpdir(), 'short-video-quality-v2-'));
  const timestamps = buildFrameTimestamps(durationSeconds);
  const labels: string[] = [];
  try {
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
      if (existsSync(framePath) && statSync(framePath).size > 0) labels.push(`frame_at_${timestamp}s`);
    });
  } finally {
    rmSync(frameDir, { recursive: true, force: true });
  }
  return { labels, timestamps };
}

function analyzeAudio(localPath: string, hasAudio: boolean): RealVideoQualityGateV2['audio'] {
  if (!hasAudio) {
    return {
      has_audio: false,
      loudness_not_silent: false,
      duration_seconds: null,
      mean_volume_db: null,
      max_volume_db: null,
      integrated_loudness_lufs: null,
      true_peak_dbtp: null,
      opening_silence: false,
      clipping_risk: false,
    };
  }

  const volume = spawnSync('ffmpeg', ['-i', localPath, '-af', 'volumedetect', '-f', 'null', '-'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const volumeText = String(volume.stderr || '');
  const parsed = parseVolume(volumeText);
  const loudness = spawnSync('ffmpeg', ['-nostats', '-i', localPath, '-filter_complex', 'ebur128=peak=true', '-f', 'null', '-'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const silence = spawnSync('ffmpeg', ['-t', '1.5', '-i', localPath, '-af', 'silencedetect=noise=-45dB:d=0.25', '-f', 'null', '-'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const loudnessText = String(loudness.stderr || '');
  const integrated = parseIntegratedLoudness(loudnessText);
  const truePeakMatches = [
    ...loudnessText.matchAll(
      /True peak:\s*Peak:\s*([+-]?(?:\d+(?:\.\d+)?|inf))\s*dBFS/gi,
    ),
  ];
  const lastTruePeakMatch = truePeakMatches[truePeakMatches.length - 1];
  const truePeakText = lastTruePeakMatch?.[1];
  const parsedTruePeak = truePeakText ? Number(truePeakText) : Number.NaN;
  const truePeakDbtp = Number.isFinite(parsedTruePeak)
    ? parsedTruePeak
    : null;
  const loudnessNotSilent = parsed.mean !== null
    ? parsed.mean > -50
    : integrated !== null
      ? integrated > -50
      : false;

  return {
    has_audio: true,
    loudness_not_silent: loudnessNotSilent,
    duration_seconds: null,
    mean_volume_db: parsed.mean,
    max_volume_db: parsed.max,
    integrated_loudness_lufs: integrated,
    true_peak_dbtp: truePeakDbtp,
    opening_silence: detectsOpeningSilence(String(silence.stderr || '')),
    clipping_risk: truePeakDbtp !== null
      ? truePeakDbtp > -1
      : parsed.max !== null
        ? parsed.max > -1
        : false,
  };
}

function sha256Prefix(localPath: string): string | null {
  try {
    const hash = execFileSync('sha256sum', [localPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return hash.trim().split(/\s+/)[0]?.slice(0, 12) || null;
  } catch {
    try {
      return crypto.createHash('sha256').update(localPath).digest('hex').slice(0, 12);
    } catch {
      return null;
    }
  }
}

function buildBase(masterVideoUrl: string, resolverSource: RealVideoAssetResolverSource = 'blocked', assetId: string | null = null, options: BuildGateOptions = {}): RealVideoQualityGateV2 {
  const visionEnabled = process.env.SHORT_VIDEO_VISION_ANALYSIS_APPROVED === 'true';
  const scoreLabel = visionEnabled ? 'vision_score' : 'technical_video_score';
  const finalMasterAssetId = cleanText(options.final_master_video_asset_id) || null;
  const rawVideoAssetId = cleanText(options.raw_video_asset_id) || null;
  const audioExpectation = options.audio_expectation === 'optional' ? 'optional' : 'required';
  return {
    real_video_quality_gate_v2: true,
    score_label: scoreLabel,
    score_kind: scoreLabel,
    analysis_timestamp: new Date().toISOString(),
    master_video_url: masterVideoUrl,
    local_video_path: null,
    asset_resolver_source: resolverSource,
    resolved_asset_id: assetId,
    analyzed_asset_id: assetId,
    raw_video_asset_id: rawVideoAssetId,
    final_master_video_asset_id: finalMasterAssetId,
    asset_role: finalMasterAssetId && assetId === finalMasterAssetId ? 'final_master_video' : rawVideoAssetId && assetId === rawVideoAssetId ? 'raw_video' : 'unknown',
    audio_expectation: audioExpectation,
    ready_for_publish: false,
    video_sha256_prefix: null,
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
    video_codec: null,
    audio_codec: null,
    audio_sample_rate: null,
    audio_channels: null,
    audio: {
      has_audio: false,
      loudness_not_silent: false,
      duration_seconds: null,
      mean_volume_db: null,
      max_volume_db: null,
      integrated_loudness_lufs: null,
      true_peak_dbtp: null,
      opening_silence: false,
      clipping_risk: false,
    },
    extracted_frames: [],
    frame_timestamps_seconds: [],
    quality_score: 0,
    hook_score: 0,
    visual_clarity_score: 0,
    audio_quality_score: 0,
    platform_fit_score: 0,
    decision: 'blocked',
    recommendations: [],
    errors: [],
  };
}

export async function buildRealVideoQualityGateV2(masterVideoUrl: string, options: BuildGateOptions = {}): Promise<RealVideoQualityGateV2> {
  const resolved = await resolveTrustedVideoAsset(masterVideoUrl, options);
  const base = buildBase(masterVideoUrl, resolved.source, resolved.ok ? resolved.assetId : null, options);

  if (!resolved.ok) {
    base.errors.push(resolved.error);
    base.recommendations.push('ไม่สามารถ resolve asset แบบปลอดภัยสำหรับ ffprobe/ffmpeg ได้ จึงบล็อกการวิเคราะห์จริง');
    return base;
  }

  base.local_video_path = resolved.safeDisplayPath;
  base.analyzed_asset_id = resolved.assetId;
  base.asset_role = base.final_master_video_asset_id && resolved.assetId === base.final_master_video_asset_id
    ? 'final_master_video'
    : (resolved.metadata?.asset_role === 'final_master_video' ? 'final_master_video' : base.asset_role);
  base.video_sha256_prefix = sha256Prefix(resolved.canonicalPath);

  try {
    const probe = runFfprobe(resolved.canonicalPath);
    base.ffprobe_performed = true;
    const videoStream = (probe.streams || []).find((stream) => stream.codec_type === 'video');
    const audioStream = (probe.streams || []).find((stream) => stream.codec_type === 'audio');
    base.video_stream = Boolean(videoStream);
    base.audio_stream = Boolean(audioStream);
    base.video_codec = videoStream?.codec_name || null;
    base.audio_codec = audioStream?.codec_name || null;
    base.audio_sample_rate = audioStream?.sample_rate ? Number(audioStream.sample_rate) : null;
    base.audio_channels = audioStream?.channels || null;
    base.width = videoStream?.width || null;
    base.height = videoStream?.height || null;
    base.duration_seconds = Number(probe.format?.duration || videoStream?.duration || 0) || null;
    base.aspect_ratio = ratioLabel(base.width, base.height);

    try {
      const frames = extractFrames(resolved.canonicalPath, base.duration_seconds);
      base.extracted_frames = frames.labels;
      base.frame_timestamps_seconds = frames.timestamps;
      base.frames_extracted = frames.labels.length > 0;
      base.video_frames_analyzed = frames.labels.length;
    } catch (error) {
      base.errors.push(`ffmpeg_frame_extraction_failed:${error instanceof Error ? error.message : 'unknown_error'}`);
    }

    base.audio = analyzeAudio(resolved.canonicalPath, Boolean(audioStream));
    base.audio.duration_seconds = audioStream?.duration ? Number(audioStream.duration) : base.duration_seconds;
    base.audio_analyzed = true;

    const durationOk = Boolean(base.duration_seconds && base.duration_seconds > 0 && base.duration_seconds <= 90);
    const verticalOk = base.aspect_ratio === '9:16' || (base.width === 1080 && base.height === 1920);
    const framesOk = base.video_frames_analyzed >= 2;
    const requiredAudioMissing = base.audio_expectation === 'required' && !base.audio.has_audio;
    const audioOk = requiredAudioMissing ? false : (!base.audio.has_audio || (base.audio.loudness_not_silent && !base.audio.clipping_risk));

    base.hook_score = clampScore((durationOk ? 70 : 35) + (framesOk ? 20 : 0) + (base.duration_seconds && base.duration_seconds <= 15 ? 10 : 0));
    base.visual_clarity_score = clampScore((base.video_stream ? 45 : 0) + (verticalOk ? 35 : 10) + (framesOk ? 20 : 0));
    base.audio_quality_score = clampScore(requiredAudioMissing
      ? 0
      : (base.audio.has_audio
        ? ((base.audio.loudness_not_silent ? 70 : 25) + (!base.audio.clipping_risk ? 20 : 0) + (!base.audio.opening_silence ? 10 : 0))
        : 65));
    base.platform_fit_score = clampScore((verticalOk ? 45 : 0) + (durationOk ? 35 : 0) + (base.video_stream ? 20 : 0));
    base.quality_score = clampScore((base.hook_score + base.visual_clarity_score + base.audio_quality_score + base.platform_fit_score) / 4);
    base.decision = requiredAudioMissing ? 'blocked' : (base.quality_score >= 80 ? 'passed' : base.quality_score >= 60 ? 'needs_review' : 'blocked');
    base.ready_for_publish = base.decision === 'passed';

    if (requiredAudioMissing) {
      base.recommendations.push('วิดีโอสุดท้ายไม่มีเสียง ทั้งที่ตั้งค่าให้ใช้เสียงบรรยาย');
      base.errors.push('required_audio_missing');
    }

    if (base.score_label === 'technical_video_score') {
      base.vision_model_called = false;
      base.recommendations.push('Vision adapter ยังปิดอยู่: คะแนนนี้คือ technical_video_score จาก ffprobe/ffmpeg ไม่ใช่ vision score');
    }
    if (!verticalOk) base.recommendations.push('ปรับวิดีโอเป็นแนวตั้ง 9:16 ก่อนโพสต์ Short/Reels/TikTok');
    if (!durationOk) base.recommendations.push('ตรวจความยาววิดีโอให้อยู่ในช่วง short video ที่เหมาะสม');
    if (base.audio.has_audio && !audioOk) base.recommendations.push('ตรวจเสียง: ต้องไม่เงียบ ไม่มี opening silence ยาว และไม่มี clipping risk');
    if (!base.audio.has_audio) base.recommendations.push('ตรวจพบวิดีโอไม่มี audio stream: วิเคราะห์เสียงสำเร็จแต่ has_audio=false');
    if (!base.recommendations.length) base.recommendations.push('ผ่าน technical gate เบื้องต้นจาก ffprobe/ffmpeg');
    return base;
  } catch (error) {
    base.errors.push(`analysis_failed:${error instanceof Error ? error.message : 'unknown_error'}`);
    base.recommendations.push('ติดตั้ง/ตรวจ ffprobe และตรวจไฟล์วิดีโอให้เปิดอ่านได้');
    return base;
  }
}

export function hasPassedRealVideoQualityGateV2(gate: RealVideoQualityGateV2 | null | undefined): boolean {
  return Boolean(gate?.real_video_quality_gate_v2 && gate.ffprobe_performed && gate.frames_extracted && gate.audio_analyzed && gate.video_stream && gate.ready_for_publish && gate.decision === 'passed' && gate.quality_score >= 80);
}
