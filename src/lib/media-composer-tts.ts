import { createHash, createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createProductVideoUploadedAssetMetadata,
  saveProductVideoUploadedAsset,
} from '@/lib/product-video-assets';

export type MediaComposerTtsVoice = 'thai_natural_female' | 'thai_natural_male';
export type MediaComposerTtsProvider = 'mock' | 'elevenlabs' | 'google' | 'phaya';

export type MediaComposerVoiceoverGenerateInput = {
  tts_script: string;
  voice?: MediaComposerTtsVoice;
  voice_name?: string;
  language?: 'th-TH' | string;
  source_badge?: 'generated_voiceover' | string;
};

export type MediaComposerVoiceoverGenerateResult = {
  ok: true;
  voiceover_audio_url: string;
  asset_id: string;
  media_type: 'audio';
  mime_type: 'audio/wav' | 'audio/mpeg';
  public_media_url: string;
  local_asset_path: string;
  source_badge: 'generated_voiceover';
  tts_provider: MediaComposerTtsProvider;
  tts_model: string;
  voice_name?: string;
  key_present?: boolean;
  generated_voiceover_used: true;
  voiceover_audio_used: true;
  audio_mix_mode: 'voiceover_only';
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
  tts_model?: string;
  voice_name?: string;
  key_present?: boolean;
  external_tts_calls_performed: boolean;
  production_actions_performed: false;
  all_publish_flags_false: true;
};

const DEFAULT_TTS_PROVIDER: MediaComposerTtsProvider = 'mock';
const DEFAULT_MOCK_TTS_MODEL = 'mock-deterministic-thai-preview-wav';
const DEFAULT_ELEVENLABS_MODEL = 'eleven_multilingual_v2';
const DEFAULT_GOOGLE_TTS_MODEL = 'google-cloud-text-to-speech';
const DEFAULT_TTS_MAX_CHARS = 350;
const APPROVED_GOOGLE_TTS_VOICE_NAMES = new Set([
  'th-TH-Chirp3-HD-Charon',
  'th-TH-Chirp3-HD-Puck',
  'th-TH-Chirp3-HD-Achird',
  'th-TH-Standard-A',
]);

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

function isApprovedGoogleTtsVoiceName(value: string): boolean {
  return APPROVED_GOOGLE_TTS_VOICE_NAMES.has(value);
}

function resolveGoogleTtsVoiceName(input?: { voice?: MediaComposerTtsVoice; voice_name?: string }): string {
  const requested = String(input?.voice_name || '').trim();
  if (requested) return isApprovedGoogleTtsVoiceName(requested) ? requested : '';
  if (input?.voice === 'thai_natural_male') return 'th-TH-Chirp3-HD-Charon';
  const envDefault = (process.env.GOOGLE_TTS_VOICE_NAME || 'th-TH-Standard-A').trim() || 'th-TH-Standard-A';
  return isApprovedGoogleTtsVoiceName(envDefault) ? envDefault : 'th-TH-Standard-A';
}

function ttsModel(provider: string): string {
  if (provider === 'elevenlabs') {
    return (process.env.ELEVENLABS_MODEL_ID || DEFAULT_ELEVENLABS_MODEL).trim() || DEFAULT_ELEVENLABS_MODEL;
  }
  if (provider === 'google') {
    return (process.env.GOOGLE_TTS_MODEL || DEFAULT_GOOGLE_TTS_MODEL).trim() || DEFAULT_GOOGLE_TTS_MODEL;
  }
  return (process.env.MEDIA_COMPOSER_TTS_MODEL || DEFAULT_MOCK_TTS_MODEL).trim() || DEFAULT_MOCK_TTS_MODEL;
}

function realTtsApproved(): boolean {
  return (process.env.MEDIA_COMPOSER_REAL_TTS_APPROVED || 'false').trim().toLowerCase() === 'true';
}

function ttsMaxChars(): number {
  const parsed = Number.parseInt((process.env.MEDIA_COMPOSER_TTS_MAX_CHARS || '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTS_MAX_CHARS;
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

function blocked(input: {
  error: string;
  message: string;
  provider: string;
  model?: string;
  keyPresent?: boolean;
  voiceName?: string;
  externalCalled?: boolean;
}): MediaComposerVoiceoverGenerateBlocked {
  return {
    ok: false,
    error: input.error,
    message: input.message,
    media_type: 'audio',
    source_badge: 'generated_voiceover',
    tts_provider: String(input.provider),
    tts_model: input.model,
    voice_name: input.voiceName,
    key_present: input.keyPresent,
    external_tts_calls_performed: Boolean(input.externalCalled),
    production_actions_performed: false,
    all_publish_flags_false: true,
  };
}

async function generateElevenLabsMp3(script: string, model: string): Promise<{ buffer: Buffer; keyPresent: boolean }> {
  const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim();
  const voiceId = (process.env.ELEVENLABS_VOICE_ID || '').trim();
  const keyPresent = Boolean(apiKey);

  if (!apiKey || !voiceId) {
    throw Object.assign(new Error('elevenlabs_credentials_missing'), {
      code: 'elevenlabs_credentials_missing',
      keyPresent,
    });
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: script,
      model_id: model,
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: 0.45,
        similarity_boost: 0.75,
        style: 0.15,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    throw Object.assign(new Error(`elevenlabs_tts_failed_${response.status}`), {
      code: 'elevenlabs_tts_failed',
      status: response.status,
      keyPresent,
    });
  }

  return { buffer: Buffer.from(await response.arrayBuffer()), keyPresent };
}

function base64Url(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function getGoogleServiceAccountAccessToken(): Promise<{ token: string; keyPresent: boolean }> {
  const credentialsPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
  if (!credentialsPath) {
    throw Object.assign(new Error('google_credentials_missing'), {
      code: 'google_credentials_missing',
      keyPresent: false,
    });
  }

  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8')) as {
    client_email?: string;
    private_key?: string;
    token_uri?: string;
  };
  const keyPresent = Boolean(credentials.private_key);
  if (!credentials.client_email || !credentials.private_key) {
    throw Object.assign(new Error('google_credentials_missing'), {
      code: 'google_credentials_missing',
      keyPresent,
    });
  }

  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64Url(JSON.stringify({
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const assertion = `${signingInput}.${base64Url(signer.sign(credentials.private_key))}`;

  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    throw Object.assign(new Error(`google_oauth_failed_${response.status}`), {
      code: 'google_oauth_failed',
      keyPresent,
      status: response.status,
    });
  }

  const body = await response.json() as { access_token?: string };
  if (!body.access_token) {
    throw Object.assign(new Error('google_oauth_token_missing'), {
      code: 'google_oauth_token_missing',
      keyPresent,
    });
  }
  return { token: body.access_token, keyPresent };
}

async function generateGoogleMp3(script: string, voiceName: string): Promise<{ buffer: Buffer; keyPresent: boolean }> {
  const { token, keyPresent } = await getGoogleServiceAccountAccessToken();
  const languageCode = (process.env.GOOGLE_TTS_LANGUAGE_CODE || 'th-TH').trim() || 'th-TH';
  const audioEncoding = (process.env.GOOGLE_TTS_AUDIO_ENCODING || 'MP3').trim().toUpperCase() || 'MP3';
  const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: { text: script },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding },
    }),
  });

  if (!response.ok) {
    throw Object.assign(new Error(`google_tts_failed_${response.status}`), {
      code: 'google_tts_failed',
      status: response.status,
      keyPresent,
    });
  }

  const body = await response.json() as { audioContent?: string };
  if (!body.audioContent) {
    throw Object.assign(new Error('google_tts_audio_missing'), {
      code: 'google_tts_audio_missing',
      keyPresent,
    });
  }
  return { buffer: Buffer.from(body.audioContent, 'base64'), keyPresent };
}

async function saveGeneratedVoiceoverAsset(input: {
  request: Request;
  buffer: Buffer;
  filename: string;
  mimeType: 'audio/wav' | 'audio/mpeg';
  provider: MediaComposerTtsProvider;
  model: string;
  externalCalled: boolean;
  keyPresent?: boolean;
  voiceName?: string;
}): Promise<MediaComposerVoiceoverGenerateResult> {
  const metadata = createProductVideoUploadedAssetMetadata({
    request: input.request,
    originalFilename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.length,
  });
  metadata.source_badge = 'generated_voiceover';
  metadata.media_type = 'audio';
  metadata.tts_provider = input.provider;
  metadata.tts_model = input.model;
  metadata.voice_name = input.voiceName;
  metadata.external_tts_calls_performed = input.externalCalled;
  await saveProductVideoUploadedAsset(metadata, input.buffer);

  return {
    ok: true,
    voiceover_audio_url: metadata.public_media_url,
    asset_id: metadata.asset_id,
    media_type: 'audio',
    mime_type: input.mimeType,
    public_media_url: metadata.public_media_url,
    local_asset_path: metadata.local_asset_path,
    source_badge: 'generated_voiceover',
    tts_provider: input.provider,
    tts_model: input.model,
    voice_name: input.voiceName,
    key_present: input.keyPresent,
    generated_voiceover_used: true,
    voiceover_audio_used: true,
    audio_mix_mode: 'voiceover_only',
    external_tts_calls_performed: input.externalCalled,
    production_actions_performed: false,
    all_publish_flags_false: true,
  };
}

export async function generateMediaComposerVoiceover(
  input: MediaComposerVoiceoverGenerateInput,
  request: Request,
): Promise<MediaComposerVoiceoverGenerateResult | MediaComposerVoiceoverGenerateBlocked> {
  const script = cleanText(input.tts_script);
  const provider = ttsProvider();
  const maxChars = ttsMaxChars();
  const voice: MediaComposerTtsVoice = input.voice === 'thai_natural_male' ? 'thai_natural_male' : 'thai_natural_female';
  const requestedVoiceName = cleanText(input.voice_name);
  const resolvedVoiceName = resolveGoogleTtsVoiceName({
    voice: input.voice,
    voice_name: requestedVoiceName,
  });
  const model = ttsModel(String(provider));

  if (!resolvedVoiceName) {
    return blocked({
      error: 'unsupported_voice_name',
      message: 'voice_name is not in the approved Media Composer Google TTS preset allowlist. No external TTS call was made.',
      provider: String(provider),
      model,
      voiceName: undefined,
    });
  }

  if (!ttsEnabled()) {
    return blocked({
      error: 'media_composer_tts_disabled',
      message: 'MEDIA_COMPOSER_TTS_ENABLED=false; AI voiceover generation is disabled and no external TTS call was made',
      provider: String(provider),
      model,
      voiceName: resolvedVoiceName,
    });
  }

  if (!script) {
    return blocked({
      error: 'tts_script_required',
      message: 'tts_script is required for generated voiceover preview',
      provider: String(provider),
      model,
      voiceName: resolvedVoiceName,
    });
  }

  if (script.length > maxChars) {
    return blocked({
      error: 'tts_script_too_long',
      message: `tts_script must be ${maxChars} characters or fewer for preview generation`,
      provider: String(provider),
      model,
      voiceName: resolvedVoiceName,
    });
  }

  if (provider === 'mock') {
    const buffer = generateDeterministicThaiPreviewWav(script, voice);
    return saveGeneratedVoiceoverAsset({
      request,
      buffer,
      filename: `generated_voiceover_${voice}.wav`,
      mimeType: 'audio/wav',
      provider: 'mock',
      model,
      externalCalled: false,
      voiceName: resolvedVoiceName,
    });
  }

  if (provider !== 'elevenlabs' && provider !== 'google' && provider !== 'phaya') {
    return blocked({
      error: 'unsupported_tts_provider',
      message: 'MEDIA_COMPOSER_TTS_PROVIDER must be mock, elevenlabs, google, or phaya',
      provider: String(provider),
      model,
      voiceName: resolvedVoiceName,
    });
  }

  if (!realTtsApproved()) {
    return blocked({
      error: 'real_tts_not_approved',
      message: 'Real TTS provider is gated. Set MEDIA_COMPOSER_REAL_TTS_APPROVED=true only after owner approval. No external TTS call was made.',
      provider: String(provider),
      model,
      keyPresent: provider === 'elevenlabs' ? Boolean((process.env.ELEVENLABS_API_KEY || '').trim()) : undefined,
      voiceName: resolvedVoiceName,
    });
  }

  if (provider === 'google') {
    try {
      const { buffer, keyPresent } = await generateGoogleMp3(script, resolvedVoiceName);
      return saveGeneratedVoiceoverAsset({
        request,
        buffer,
        filename: 'generated_voiceover_google.mp3',
        mimeType: 'audio/mpeg',
        provider: 'google',
        model,
        externalCalled: true,
        keyPresent,
        voiceName: resolvedVoiceName,
      });
    } catch (error) {
      const keyPresent = typeof error === 'object' && error !== null && 'keyPresent' in error
        ? Boolean((error as { keyPresent?: boolean }).keyPresent)
        : Boolean((process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim());
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: string }).code)
        : 'google_tts_failed';
      return blocked({
        error: code,
        message: 'Google Cloud Text-to-Speech failed or is not fully configured. Secret values were not printed; only key_present is reported.',
        provider: 'google',
        model,
        keyPresent,
        voiceName: resolvedVoiceName,
        externalCalled: code !== 'google_credentials_missing',
      });
    }
  }

  if (provider === 'phaya') {
    return blocked({
      error: 'real_tts_provider_not_implemented_safe_build',
      message: `${provider} TTS is reserved for a later safe-build. No external TTS call was made.`,
      provider: String(provider),
      model,
      voiceName: resolvedVoiceName,
    });
  }

  try {
    const { buffer, keyPresent } = await generateElevenLabsMp3(script, model);
    return saveGeneratedVoiceoverAsset({
      request,
      buffer,
      filename: 'generated_voiceover_elevenlabs.mp3',
      mimeType: 'audio/mpeg',
      provider: 'elevenlabs',
      model,
      externalCalled: true,
      keyPresent,
      voiceName: resolvedVoiceName,
    });
  } catch (error) {
    const keyPresent = typeof error === 'object' && error !== null && 'keyPresent' in error
      ? Boolean((error as { keyPresent?: boolean }).keyPresent)
      : Boolean((process.env.ELEVENLABS_API_KEY || '').trim());
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: string }).code)
      : 'elevenlabs_tts_failed';
    return blocked({
      error: code,
      message: 'ElevenLabs TTS failed or is not fully configured. Secret values were not printed; only key_present is reported.',
      provider: 'elevenlabs',
      model,
      keyPresent,
      voiceName: resolvedVoiceName,
      externalCalled: code !== 'elevenlabs_credentials_missing',
    });
  }
}
