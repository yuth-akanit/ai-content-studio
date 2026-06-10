export type TikTokPrivacyLevel =
  | 'SELF_ONLY'
  | 'MUTUAL_FOLLOW_FRIENDS'
  | 'FOLLOWER_OF_CREATOR'
  | 'PUBLIC_TO_EVERYONE';

export type TikTokPostInput = {
  accessToken: string;
  videoUrl: string;
  caption: string;
  privacyLevel?: TikTokPrivacyLevel;
};

interface TikTokInitResponse {
  data?: {
    publish_id?: string;
    [key: string]: unknown;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
  [key: string]: unknown;
}

function sanitizeTikTokPayload(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
  } catch {
    return 'unreadable response';
  }
}

export async function postTikTokVideo(input: TikTokPostInput) {
  if (!input.videoUrl?.trim()) {
    throw new Error('TikTok posting requires video_url');
  }

  const privacyLevel = input.privacyLevel || 'SELF_ONLY';
  if (privacyLevel === 'PUBLIC_TO_EVERYONE' && process.env.TIKTOK_ALLOW_PUBLIC_DIRECT_POST !== 'true') {
    throw new Error('TikTok public direct post is disabled');
  }

  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: input.caption.slice(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: input.videoUrl,
      },
    }),
  });

  const initJson = await response.json().catch(() => ({})) as TikTokInitResponse;
  const errorCode = initJson.error?.code;
  if (!response.ok || (errorCode && errorCode !== 'ok')) {
    throw new Error(`TikTok post init failed (${response.status}): ${sanitizeTikTokPayload(initJson)}`);
  }

  const publishId = initJson.data?.publish_id;
  if (!publishId) {
    throw new Error(`TikTok post init response did not include publish_id: ${sanitizeTikTokPayload(initJson)}`);
  }

  return {
    provider: 'tiktok' as const,
    success: true,
    post_external_id: publishId,
    raw: initJson,
  };
}
