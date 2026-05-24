// Fal.ai client import removed per policy (no new dependencies)
import { NextRequest, NextResponse } from 'next/server';

const MAX_TRANSCRIBE_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      {
        ok: false,
        code: "VALIDATION_ERROR",
        message: "Content-Type must be multipart/form-data with a video file.",
        transcript: null,
      },
      { status: 400 }
    );
  }
    const video = formData.get('video');

    if (!(video instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'video file is required',
          transcript: null
        },
        { status: 400 },
      );
    }

    if (video.size <= 0) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'video file is empty',
          transcript: null
        },
        { status: 400 },
      );
    }

    if (video.size > MAX_TRANSCRIBE_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          code: 'VALIDATION_ERROR',
          message: 'video file exceeds max size for transcription',
          transcript: null
        },
        { status: 400 },
      );
    }

    // Primary STT provider configuration
    const sttProvider = process.env.STT_PROVIDER || 'fal';
    if (sttProvider === 'fal' && process.env.FAL_KEY) {
      // Fal.ai requires a publicly accessible audio_url, which we do not have.
      // Log a sanitized provider_unavailable message and skip Fal, falling back to OpenRouter.
      console.error(JSON.stringify({ provider_unavailable: 'fal.ai requires public audio_url' }));
      // Continue to OpenRouter fallback without returning.
    }
    // If Fal is not configured (no key) or skipped, fall through to OpenRouter fallback.
    // OpenRouter fallback (or if Fal not configured)
    const apiKey = process.env.TRANSCRIBE_API_KEY || process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, code: 'AI_PROVIDER_ERROR', message: 'Video transcription API key is not configured.', transcript: null }, { status: 502 });
    }
    const buffer = Buffer.from(await video.arrayBuffer());
    const base64Audio = buffer.toString('base64');
    let format = 'mp3';
    const ext = video.name.split('.').pop()?.toLowerCase();
    if (ext && ['mp3', 'wav', 'flac', 'ogg', 'webm', 'mp4', 'm4a'].includes(ext)) {
      format = ext;
    } else if (video.type) {
      const mimeMatch = video.type.split('/')[1]?.toLowerCase();
      if (mimeMatch && ['mp3', 'wav', 'flac', 'ogg', 'webm', 'mp4', 'm4a'].includes(mimeMatch)) {
        format = mimeMatch;
      }
    }
    const transcribeModel = process.env.AI_TRANSCRIBE_MODEL || 'openai/whisper-large-v3';
    const baseURL = process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1';
    const apiURL = `${baseURL.replace(/\/+$/, '')}/audio/transcriptions`;
    const response = await fetch(apiURL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://studio.paaair.online',
        'X-Title': 'AI Content Studio',
      },
      body: JSON.stringify({
        model: transcribeModel,
        input_audio: { data: base64Audio, format },
        language: 'th',
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter audio transcription error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    return NextResponse.json({
      ok: true,
      provider: 'openrouter',
      model: transcribeModel,
      transcript: data.text || '',
    });
  } catch (error) {
    // Sanitized error logging
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ error: errMsg }));
    const lower = errMsg.toLowerCase();
    if (lower.includes('quota') || lower.includes('429') || lower.includes('rate limit')) {
      return NextResponse.json(
        { ok: false, code: 'AI_QUOTA_EXCEEDED', message: 'Video transcription quota exceeded. Continue without transcript.', transcript: null },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { ok: false, code: 'AI_PROVIDER_ERROR', message: `Video transcription failed: ${errMsg}`, transcript: null },
      { status: 502 },
    );
  }
}

