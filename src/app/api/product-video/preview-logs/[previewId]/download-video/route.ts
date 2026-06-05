import { NextRequest, NextResponse } from 'next/server';
import {
  PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
  findProductVideoPreviewLogById,
} from '@/lib/product-video-preview-log';

export const dynamic = 'force-dynamic';

const TRUSTED_MEDIA_HOSTS = new Set(['admin.paaair.online', 'studio.paaair.online']);
const TRUSTED_MEDIA_PATH_PREFIXES = ['/media/', '/api/product-video/assets/'];
const MAX_REDIRECTS = 3;

type DownloadRouteContext = {
  params: Promise<{ previewId?: string }>;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getPreviewVideoUrl(item: unknown): string {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
  return cleanText(record.public_media_url) || cleanText(record.video_url);
}

function isTrustedProductVideoMediaUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return (
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      TRUSTED_MEDIA_HOSTS.has(parsed.hostname) &&
      TRUSTED_MEDIA_PATH_PREFIXES.some((prefix) => parsed.pathname.startsWith(prefix))
    );
  } catch {
    return false;
  }
}

function getSafeFilename(previewId: string): string {
  const safePreviewId = previewId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'preview';
  return `product-video-${safePreviewId}.mp4`;
}

async function fetchTrustedMedia(mediaUrl: string): Promise<Response> {
  let currentUrl = mediaUrl;

  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    if (!isTrustedProductVideoMediaUrl(currentUrl)) {
      throw Object.assign(new Error('untrusted_media_url'), { code: 'untrusted_media_url', status: 400 });
    }

    const response = await fetch(currentUrl, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      headers: {
        Accept: 'video/mp4,video/*;q=0.9,*/*;q=0.1',
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw Object.assign(new Error('media_redirect_missing_location'), { code: 'media_redirect_missing_location', status: 502 });
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    if (!isTrustedProductVideoMediaUrl(response.url || currentUrl)) {
      throw Object.assign(new Error('untrusted_media_redirect'), { code: 'untrusted_media_redirect', status: 400 });
    }

    return response;
  }

  throw Object.assign(new Error('too_many_media_redirects'), { code: 'too_many_media_redirects', status: 502 });
}

export async function GET(_request: NextRequest, { params }: DownloadRouteContext) {
  const { previewId: rawPreviewId } = await params;
  const previewId = cleanText(rawPreviewId);

  if (!previewId) {
    return NextResponse.json(
      { ok: false, error: 'preview_id_required', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status: 400 },
    );
  }

  try {
    const item = await findProductVideoPreviewLogById(previewId);
    if (!item) {
      return NextResponse.json(
        { ok: false, error: 'preview_log_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 },
      );
    }

    const mediaUrl = getPreviewVideoUrl(item);
    if (!mediaUrl) {
      return NextResponse.json(
        { ok: false, error: 'video_url_not_found', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 404 },
      );
    }

    if (!isTrustedProductVideoMediaUrl(mediaUrl)) {
      return NextResponse.json(
        { ok: false, error: 'untrusted_media_url', ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
        { status: 400 },
      );
    }

    const mediaResponse = await fetchTrustedMedia(mediaUrl);
    if (!mediaResponse.ok || !mediaResponse.body) {
      return NextResponse.json(
        {
          ok: false,
          error: 'media_fetch_failed',
          source_status: mediaResponse.status,
          ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS,
        },
        { status: 502 },
      );
    }

    const contentType = mediaResponse.headers.get('content-type') || 'video/mp4';
    const contentLength = mediaResponse.headers.get('content-length');
    const headers = new Headers({
      'Content-Type': contentType || 'video/mp4',
      'Content-Disposition': `attachment; filename="${getSafeFilename(previewId)}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });

    if (contentLength) {
      headers.set('Content-Length', contentLength);
    }

    return new NextResponse(mediaResponse.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    const code = typeof (error as { code?: unknown }).code === 'string'
      ? (error as { code: string }).code
      : 'download_video_failed';

    if (status >= 500) {
      console.error('[product-video] download video failed', error);
    }

    return NextResponse.json(
      { ok: false, error: code, ...PRODUCT_VIDEO_PREVIEW_SAFETY_FLAGS },
      { status },
    );
  }
}
