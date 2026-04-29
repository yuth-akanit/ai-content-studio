import { OpenAI } from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const MAX_TRANSCRIBE_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const video = formData.get('video');

    if (!(video instanceof File)) {
      return NextResponse.json(
        { error: 'video file is required' },
        { status: 400 },
      );
    }

    if (video.size <= 0) {
      return NextResponse.json(
        { error: 'video file is empty' },
        { status: 400 },
      );
    }

    if (video.size > MAX_TRANSCRIBE_VIDEO_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'video file exceeds max size for transcription' },
        { status: 400 },
      );
    }

    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI_API_KEY not configured' },
        { status: 500 },
      );
    }

    const client = new OpenAI({
      apiKey,
      baseURL: process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    });

    const transcription = await client.audio.transcriptions.create({
      file: video,
      model: process.env.AI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe',
      language: 'th',
      response_format: 'json',
    });

    return NextResponse.json({
      transcript: transcription.text || '',
    });
  } catch (error) {
    console.error('Video transcription route error:', error);
    const message =
      error instanceof Error ? error.message : 'Video transcription failed';

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
