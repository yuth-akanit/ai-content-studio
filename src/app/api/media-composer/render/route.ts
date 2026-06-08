import { NextRequest, NextResponse } from 'next/server';
import {
  buildMediaComposerMasterVideoRecord,
  sampleMediaComposerImagePairInput,
  sampleMediaComposerMasterVideoRecord,
  validateMediaComposerInput,
  type MediaComposerInput,
} from '@/lib/media-composer';

import { listReadOnlyMediaComposerSourceOptions } from '@/lib/media-composer-real-media-adapter';
import { renderUploadedRawVideoPreview } from '@/lib/media-composer-raw-video-renderer';

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

    const rawVideoRender = body.source_type === 'raw_video' && body.source_badge === 'uploaded_asset'
      ? await renderUploadedRawVideoPreview(body, request)
      : null;

    if (rawVideoRender && !rawVideoRender.ok) {
      return NextResponse.json(
        rawVideoRender,
        { status: rawVideoRender.status === 'renderer_missing' ? 503 : 400 },
      );
    }

    const masterVideo = buildMediaComposerMasterVideoRecord(body, rawVideoRender?.ok ? {
      master_video_url: rawVideoRender.public_media_url,
      duration_seconds: rawVideoRender.duration_seconds,
      render_mode: 'composed_preview_mp4',
      renderer_status: 'rendered',
      fallback_used: false,
      master_video_url_is_original_upload: false,
      visible_overlays: rawVideoRender.visible_overlays,
    } : undefined);
    const distributionPreviewParams = new URLSearchParams({
      master_video_id: masterVideo.id,
      master_video_url: masterVideo.master_video_url,
      source_type: masterVideo.source_type,
      source_badge: masterVideo.source_badge,
      source_id: masterVideo.source_id || '',
      tts_script: masterVideo.tts_script,
      fallback_used: String(masterVideo.fallback_used),
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
        fallback_used: masterVideo.fallback_used,
        render_mode: masterVideo.render_mode,
        renderer_status: masterVideo.renderer_status,
        master_video_url_is_original_upload: masterVideo.master_video_url_is_original_upload,
        master_video_url_is_sample: masterVideo.master_video_url.startsWith('/samples/'),
        visible_overlays: masterVideo.visible_overlays,
      },
      raw_video_render: rawVideoRender,
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
