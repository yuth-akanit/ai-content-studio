import { NextResponse } from 'next/server';
import { listReadOnlyMediaComposerSourceOptions } from '@/lib/media-composer-real-media-adapter';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await listReadOnlyMediaComposerSourceOptions();
    return NextResponse.json({
      ok: true,
      module: 'media_composer_real_media_adapter_v1',
      mode: 'read_only_preview_metadata',
      source_options: result.options,
      fallback_used: result.fallback_used,
      source_counts: result.source_counts,
      production_actions_performed: result.production_actions_performed,
      publish_flags: {
        facebook_publish_enabled: false,
        instagram_publish_enabled: false,
        tiktok_publish_enabled: false,
        youtube_publish_enabled: false,
        line_broadcast_enabled: false,
        scheduler_enabled: false,
        production_actions_performed: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'media_composer_sources_failed',
        message: error instanceof Error ? error.message : 'Unknown source adapter error',
        production_actions_performed: false,
      },
      { status: 500 },
    );
  }
}
