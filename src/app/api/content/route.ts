import { NextRequest, NextResponse } from 'next/server';
import { getContents } from '@/lib/repositories/content';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const profileId = searchParams.get('profile_id');

    if (!profileId) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 });
    }

    const fields = searchParams.get('fields') || 'id,business_profile_id,project_id,platform,platform_variant,content_type,topic,service_type,output_payload,language,tone,content_goal,post_length,asset_type,visual_direction,status,created_at';

    const result = await getContents(profileId, {
      platform: searchParams.get('platform') || undefined,
      content_type: searchParams.get('content_type') || undefined,
      project_id: searchParams.get('project_id') || undefined,
      status: searchParams.get('status') || undefined,
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    }, fields);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch content';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
