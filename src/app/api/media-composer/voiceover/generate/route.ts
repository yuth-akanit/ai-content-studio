import { NextRequest, NextResponse } from 'next/server';
import {
  generateMediaComposerVoiceover,
  type MediaComposerVoiceoverGenerateInput,
} from '@/lib/media-composer-tts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MediaComposerVoiceoverGenerateInput;
    const result = await generateMediaComposerVoiceover(
      {
        tts_script: body.tts_script,
        voice: body.voice,
        language: body.language || 'th-TH',
        source_badge: 'generated_voiceover',
      },
      request,
    );

    return NextResponse.json(
      {
        ...result,
        module: 'media_composer_voiceover_v2_3a',
        preview_only: true,
        production_actions_performed: false,
        publish_flags: {
          facebook_publish_enabled: false,
          instagram_publish_enabled: false,
          tiktok_publish_enabled: false,
          youtube_publish_enabled: false,
          line_broadcast_enabled: false,
          scheduler_enabled: false,
          production_actions_performed: false,
        },
      },
      { status: result.ok ? 200 : 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        module: 'media_composer_voiceover_v2_3a',
        preview_only: true,
        error: 'media_composer_voiceover_generate_failed',
        message: error instanceof Error ? error.message : 'Unknown voiceover generation error',
        media_type: 'audio',
        source_badge: 'generated_voiceover',
        external_tts_calls_performed: false,
        production_actions_performed: false,
        all_publish_flags_false: true,
      },
      { status: 500 },
    );
  }
}
