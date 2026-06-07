import { NextRequest, NextResponse } from 'next/server';
import {
  buildMediaComposerMasterVideoRecord,
  sampleMediaComposerImagePairInput,
  sampleMediaComposerMasterVideoRecord,
  validateMediaComposerInput,
  type MediaComposerInput,
} from '@/lib/media-composer';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    module: 'media_composer_v1',
    mode: 'preview_render_only',
    supported_source_types: ['image_pair', 'raw_video'],
    sample_input: sampleMediaComposerImagePairInput,
    master_video: sampleMediaComposerMasterVideoRecord,
    publish_flags: sampleMediaComposerMasterVideoRecord.publish_flags,
    ready_for_distribution_preview: sampleMediaComposerMasterVideoRecord.ready_for_distribution_preview,
    production_actions_performed: false,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MediaComposerInput;
    const errors = validateMediaComposerInput(body);
    if (errors.length) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_media_composer_input',
          errors,
          production_actions_performed: false,
        },
        { status: 400 },
      );
    }

    const masterVideo = buildMediaComposerMasterVideoRecord(body);
    return NextResponse.json({
      ok: true,
      module: 'media_composer_v1',
      mode: 'preview_render_only',
      master_video: masterVideo,
      master_video_record: {
        master_video_url: masterVideo.master_video_url,
        duration_seconds: masterVideo.duration_seconds,
        source_type: masterVideo.source_type,
        tts_script: masterVideo.tts_script,
        ready_for_distribution_preview: masterVideo.ready_for_distribution_preview,
      },
      short_video_distribution_preview_url: `/short-video-distribution?master_video_id=${encodeURIComponent(masterVideo.id)}`,
      publish_flags: masterVideo.publish_flags,
      production_actions_performed: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'media_composer_render_failed',
        message: error instanceof Error ? error.message : 'Unknown media composer error',
        production_actions_performed: false,
      },
      { status: 500 },
    );
  }
}
