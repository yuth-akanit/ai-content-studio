import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVideoBucketName, uploadDataUrlToStorage } from '@/lib/server/media-storage';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const body = await request.json();
    const videoDataUrl = body.video_data_url as string | undefined;

    if (!videoDataUrl) {
      return NextResponse.json(
        {
          success: false,
          error_type: 'preflight',
          error_stage: 'preflight_validation',
          error: 'video_data_url is required',
        },
        { status: 400 },
      );
    }

    if (!videoDataUrl.startsWith('data:video/')) {
      return NextResponse.json(
        {
          success: false,
          error_type: 'preflight',
          error_stage: 'preflight_validation',
          error: 'video_data_url must be a video data URL',
        },
        { status: 400 },
      );
    }

    const upload = await uploadDataUrlToStorage(
      supabase,
      videoDataUrl,
      getVideoBucketName(),
      'content_video',
    );

    return NextResponse.json({
      success: true,
      stage: 'storage_upload_complete',
      public_url: upload.publicUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video upload failed';
    return NextResponse.json(
      {
        success: false,
        error_type: 'storage',
        error_stage: 'supabase_storage_upload',
        error: message,
      },
      { status: 500 },
    );
  }
}
