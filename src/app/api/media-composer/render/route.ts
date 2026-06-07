import { NextRequest, NextResponse } from 'next/server';
import {
  buildMediaComposerMasterVideoRecord,
  sampleMediaComposerImagePairInput,
  sampleMediaComposerMasterVideoRecord,
  validateMediaComposerInput,
  type MediaComposerInput,
} from '@/lib/media-composer';

import { listReadOnlyMediaComposerSourceOptions } from '@/lib/media-composer-real-media-adapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sources = await listReadOnlyMediaComposerSourceOptions();
  return NextResponse.json({
    ok: true,
    module: 'media_composer_v1',
    mode: 'preview_render_only',
    supported_source_types: ['image_pair', 'raw_video'],
    sample_input: sampleMediaComposerImagePairInput,
    source_options: sources.options,
    fallback_used: sources.fallback_used,
    source_counts: sources.source_counts,
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
    const distributionPreviewParams = new URLSearchParams({
      master_video_id: masterVideo.id,
      master_video_url: masterVideo.master_video_url,
      source_type: masterVideo.source_type,
      source_badge: masterVideo.source_badge,
      source_id: masterVideo.source_id || '',
      tts_script: masterVideo.tts_script,
      fallback_used: String(masterVideo.source_badge === 'sample'),
      ready_for_distribution_preview: String(masterVideo.ready_for_distribution_preview),
    });

    return NextResponse.json({
      ok: true,
      module: 'media_composer_v1',
      mode: 'preview_render_only',
      master_video: masterVideo,
      master_video_record: {
        master_video_url: masterVideo.master_video_url,
        duration_seconds: masterVideo.duration_seconds,
        source_type: masterVideo.source_type,
        source_badge: masterVideo.source_badge,
        source_id: masterVideo.source_id,
        tts_script: masterVideo.tts_script,
        ready_for_distribution_preview: masterVideo.ready_for_distribution_preview,
        fallback_used: masterVideo.source_badge === 'sample',
      },
      short_video_distribution_preview_url: `/short-video-distribution?${distributionPreviewParams.toString()}`,
      publish_flags: masterVideo.publish_flags,
      all_publish_flags_false: true,
      external_api_calls_performed: false,
      mark_posted_performed: false,
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
