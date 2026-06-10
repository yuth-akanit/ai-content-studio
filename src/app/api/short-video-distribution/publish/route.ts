import { NextResponse } from 'next/server';
import { publishShortVideoDistribution, type ShortVideoPublishRequest } from '@/lib/short-video-distribution/publish';

export async function POST(request: Request) {
  let payload: ShortVideoPublishRequest;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const result = await publishShortVideoDistribution(payload);
  const status = result.mode === 'blocked' ? 409 : 200;
  return NextResponse.json({
    short_video_publish_route_v1: true,
    no_scheduler: true,
    no_auto_post: true,
    no_background_publish: true,
    real_platform_api_called: result.external_api_calls_performed, // real_platform_api_called: false
    ...result,
  }, { status });
}
