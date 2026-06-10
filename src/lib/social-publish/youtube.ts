import crypto from 'crypto';

export type YouTubeUploadInput = {
  accessToken: string;
  videoUrl: string;
  title: string;
  description?: string;
  privacyStatus?: 'private' | 'unlisted' | 'public';
};

interface YouTubeUploadResponse {
  id?: string;
  [key: string]: unknown;
}

function sanitizeApiPayload(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
  } catch {
    return 'unreadable response';
  }
}

function truncateTitle(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return 'PAA Air Service Short';
  return trimmed.length > 100 ? trimmed.slice(0, 100) : trimmed;
}

export async function uploadYouTubeShort(input: YouTubeUploadInput) {
  if (!input.videoUrl?.trim()) {
    throw new Error('YouTube posting requires video_url');
  }

  const videoResponse = await fetch(input.videoUrl);
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch YouTube video_url (${videoResponse.status})`);
  }

  const videoBuffer = await videoResponse.arrayBuffer();
  if (!videoBuffer.byteLength) {
    throw new Error('YouTube video_url returned an empty body');
  }

  const videoContentType = videoResponse.headers.get('content-type') || 'video/mp4';
  const metadata = {
    snippet: {
      title: truncateTitle(input.title),
      description: input.description || '',
      categoryId: '22',
    },
    status: {
      privacyStatus: input.privacyStatus || 'private',
      selfDeclaredMadeForKids: false,
    },
  };

  const boundary = `paa-youtube-${crypto.randomUUID()}`;
  const delimiter = `--${boundary}`;
  const closeDelimiter = `--${boundary}--`;
  const encoder = new TextEncoder();
  const body = new Blob([
    encoder.encode(`${delimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
    encoder.encode(JSON.stringify(metadata)),
    encoder.encode(`\r\n${delimiter}\r\nContent-Type: ${videoContentType}\r\n\r\n`),
    videoBuffer,
    encoder.encode(`\r\n${closeDelimiter}\r\n`),
  ]);

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );

  const raw = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok) {
    throw new Error(`YouTube upload failed (${uploadResponse.status}): ${sanitizeApiPayload(raw)}`);
  }

  const json = raw as YouTubeUploadResponse;
  if (!json.id) {
    throw new Error(`YouTube upload response did not include a video id: ${sanitizeApiPayload(json)}`);
  }

  return {
    provider: 'youtube' as const,
    success: true,
    post_external_id: json.id,
    raw: json,
  };
}
