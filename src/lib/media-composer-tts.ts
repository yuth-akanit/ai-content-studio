import { createHash } from 'node:crypto';
import {
  createProductVideoUploadedAssetMetadata,
  saveProductVideoUploadedAsset,
} from '@/lib/product-video-assets';

export type MediaComposerTtsVoice = 'thai_natural_female' | 'thai_natural_male';
export type MediaComposerTtsProvider = 'openai' | 'mock';

export type MediaComposerVoiceoverGenerateInput = {
  tts_script: string;
  voice?: MediaComposerTtsVoice;
  language?: 'th-TH' | string;
  source_badge?: 'generated_voiceover' | string;
};

export type MediaComposerVoiceoverGenerateResult = {
  ok: true;
  voiceover_audio_url: string;
  asset_id: string;
  media_type: 'audio';
  mime_type: 'audio/wav' | 'audio/mpeg';
  source_badge: 'generated_voiceover';
  tts_provider: MediaComposerTtsProvider;
  tts_model: string;
  external_tts_calls_performed: boolean;
  production_actions_performed: false;
  all_publish_flags_false: true;
};

export type MediaComposerVoiceoverGenerateBlocked = {
  ok: false;
  error: string;
  message: string;
  media_type: 'audio';
  source_badge: 'generated_voiceover';
  tts_provider: string;
  external_tts_calls_performed: false;
  production_actions_performed: false;
  all_publish_flags_false: true;
};

const DEFAULT_TTS_PROVIDER: MediaComposerTtsProvider = 'openai';
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts';
const MAX_TTS_SCRIPT_CHARS = 1800;

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function ttsEnabled(): boolean {
  return (process.env.MEDIA_COMPOSER_TTS_ENABLED || 'false').trim().toLowerCase() === 'true';
}

function ttsProvider(): MediaComposerTtsProvider | string {
  const provider = (process.env.MEDIA_COMPOSER_TTS_PROVIDER || DEFAULT_TTS_PROVIDER).trim().toLowerCase();
  return provider || DEFAULT_TTS_PROVIDER;
}

function ttsModel(): string {
  return (process.env.MEDIA_COMPOSER_TTS_MODEL || DEFAULT_TTS_MODEL).trim() || DEFAULT_TTS_MODEL;
}

function realTtsApproved(): boolean {
  return (process.env.MEDIA_COMPOSER_REAL_TTS_APPROVED || 'false').trim().toLowerCase() === 'true';
}

function makeWavHeader(dataBytes: number, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataBytes, 40);
  return header;
}

function generateDeterministicThaiPreviewWav(script: string, voice: MediaComposerTtsVoice): Buffer {
  const sampleRate = 16000;
  const durationSeconds = Math.min(8, Math.max(2.5, script.length / 45));
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const data = Buffer.alloc(sampleCount * 2);
  const seedHex = createHash('sha256').update(`${voice}:${script}`).digest('hex').slice(0, 8);
  const seed = Number.parseInt(seedHex, 16);
  const baseFrequency = voice === 'thai_natural_male' ? 165 : 220;
  const frequency = baseFrequency + (seed % 35);

  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / sampleRate;
    const envelope = Math.min(1, index / (sampleRate * 0.12), (sampleCount - index) / (sampleRate * 0.18));
    const carrier = Math.sin(2 * Math.PI * frequency * t);
    const overtone = 0.35 * Math.sin(2 * Math.PI * frequency * 1.5 * t);
    const pause = Math.sin(2 * Math.PI * 1.8 * t) > -0.82 ? 1 : 0.15;
    const value = Math.round((carrier + overtone) * 9500 * envelope * pause);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, value)), index * 2);
  }

  return Buffer.concat([makeWavHeader(data.length, sampleRate), data]);
}

export async function generateMediaComposerVoiceover(
  input: MediaComposerVoiceoverGenerateInput,
  request: Request,
): Promise<MediaComposerVoiceoverGenerateResult | MediaComposerVoiceoverGenerateBlocked> {
  const script = cleanText(input.tts_script);
  const provider = ttsProvider();
  const model = ttsModel();
  const voice: MediaComposerTtsVoice = input.voice === 'thai_natural_male' ? 'thai_natural_male' : 'thai_natural_female';

  if (!ttsEnabled()) {
    return {
      ok: false,
      error: 'media_composer_tts_disabled',
      message: 'MEDIA_COMPOSER_TTS_ENABLED=false; AI voiceover generation is disabled and no external TTS call was made',
      media_type: 'audio',
      source_badge: 'generated_voiceover',
      tts_provider: String(provider),
      external_tts_calls_performed: false,
      production_actions_performed: false,
      all_publish_flags_false: true,
    };
  }

  if (!script) {
    return {
      ok: false,
      error: 'tts_script_required',
      message: 'tts_script is required for generated voiceover preview',
      media_type: 'audio',
      source_badge: 'generated_voiceover',
      tts_provider: String(provider),
      external_tts_calls_performed: false,
      production_actions_performed: false,
      all_publish_flags_false: true,
    };
  }

  if (script.length > MAX_TTS_SCRIPT_CHARS) {
    return {
      ok: false,
      error: 'tts_script_too_long',
      message: `tts_script must be ${MAX_TTS_SCRIPT_CHARS} characters or fewer for preview generation`,
      media_type: 'audio',
      source_badge: 'generated_voiceover',
      tts_provider: String(provider),
      external_tts_calls_performed: false,
      production_actions_performed: false,
      all_publish_flags_false: true,
    };
  }

  if (provider !== 'mock') {
    if (!realTtsApproved()) {
      return {
        ok: false,
        error: 'real_tts_provider_not_approved',
        message: 'Real TTS provider is gated. Set MEDIA_COMPOSER_REAL_TTS_APPROVED=true only after owner approval. No external TTS call was made.',
        media_type: 'audio',
        source_badge: 'generated_voiceover',
        tts_provider: String(provider),
        external_tts_calls_performed: false,
        production_actions_performed: false,
        all_publish_flags_false: true,
      };
    }

    return {
      ok: false,
      error: 'real_tts_provider_not_implemented_safe_build',
      message: 'Safe-build currently blocks real TTS execution until owner approves and provider implementation proof is run. No external TTS call was made.',
      media_type: 'audio',
      source_badge: 'generated_voiceover',
      tts_provider: String(provider),
      external_tts_calls_performed: false,
      production_actions_performed: false,
      all_publish_flags_false: true,
    };
  }

  const buffer = generateDeterministicThaiPreviewWav(script, voice);
  const metadata = createProductVideoUploadedAssetMetadata({
    request,
    originalFilename: `generated_voiceover_${voice}.wav`,
    mimeType: 'audio/wav',
    sizeBytes: buffer.length,
  });
  metadata.source_badge = 'generated_voiceover';
  await saveProductVideoUploadedAsset(metadata, buffer);

  return {
    ok: true,
    voiceover_audio_url: metadata.public_media_url,
    asset_id: metadata.asset_id,
    media_type: 'audio',
    mime_type: 'audio/wav',
    source_badge: 'generated_voiceover',
    tts_provider: 'mock',
    tts_model: model,
    external_tts_calls_performed: false,
    production_actions_performed: false,
    all_publish_flags_false: true,
  };
}
