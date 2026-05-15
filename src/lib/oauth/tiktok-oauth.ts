import { createHmac, timingSafeEqual } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SocialAccountToken,
  updateSocialAccountToken,
  upsertSocialAccountToken,
} from '@/lib/repositories/social-account-tokens';

const DEFAULT_APP_BASE_URL = 'https://studio.paaair.online';
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_CREATOR_INFO_URL = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';
const TIKTOK_SCOPES = ['video.publish'];
const REFRESH_SKEW_MS = 5 * 60 * 1000;

interface TikTokOAuthConfig {
  clientKey: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
}

interface TikTokOAuthState {
  social_page_id: string;
  ts: number;
}

interface TikTokTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  token_type?: string;
  scope?: string;
  open_id?: string;
  error?: string;
  error_description?: string;
  message?: string;
  log_id?: string;
}

interface TikTokCreatorInfoResponse {
  data?: {
    creator_avatar_url?: string;
    creator_username?: string;
    creator_nickname?: string;
    privacy_level_options?: string[];
    comment_disabled?: boolean;
    duet_disabled?: boolean;
    stitch_disabled?: boolean;
    max_video_post_duration_sec?: number;
    [key: string]: unknown;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
  [key: string]: unknown;
}

export interface SanitizedTikTokCreatorInfo {
  creator_avatar_url: string | null;
  creator_username: string | null;
  creator_nickname: string | null;
  privacy_level_options: string[];
  comment_disabled: boolean | null;
  duet_disabled: boolean | null;
  stitch_disabled: boolean | null;
  max_video_post_duration_sec: number | null;
}

function getTikTokOAuthConfig(): TikTokOAuthConfig {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = getTikTokRedirectUri();
  const stateSecret = process.env.INTERNAL_API_SECRET;

  if (!clientKey || !clientSecret || !redirectUri || !stateSecret) {
    throw new Error('TikTok OAuth is not configured');
  }

  return { clientKey, clientSecret, redirectUri, stateSecret };
}

export function getPublicAppBaseUrl() {
  const configuredUrl =
    process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_BASE_URL;

  try {
    const url = new URL(configuredUrl);
    if (url.hostname === '0.0.0.0') return DEFAULT_APP_BASE_URL;
    return url.origin;
  } catch {
    return DEFAULT_APP_BASE_URL;
  }
}

export function getTikTokRedirectUri() {
  const configuredUri = process.env.TIKTOK_REDIRECT_URI;
  const fallbackUri = `${getPublicAppBaseUrl()}/api/oauth/tiktok/callback`;
  const redirectUri = configuredUri || fallbackUri;

  try {
    const url = new URL(redirectUri);
    if (url.hostname === '0.0.0.0') return fallbackUri;
    return url.toString();
  } catch {
    return fallbackUri;
  }
}

function toBase64Url(value: string) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
}

function signStatePayload(payload: string, secret: string) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function expiresAtFromExpiresIn(expiresIn?: number) {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

function shouldRefreshToken(token: SocialAccountToken) {
  if (!token.expires_at) return false;
  const expiresAtMs = Date.parse(token.expires_at);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + REFRESH_SKEW_MS;
}

async function parseTikTokJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({})) as Promise<T>;
}

function sanitizeTikTokError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 'TikTok request failed';
  const record = payload as Record<string, unknown>;
  const nestedError =
    record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : null;
  const code =
    typeof nestedError?.code === 'string'
      ? nestedError.code
      : typeof record.error === 'string'
        ? record.error
        : 'tiktok_error';
  const message =
    typeof nestedError?.message === 'string'
      ? nestedError.message
      : typeof record.error_description === 'string'
        ? record.error_description
        : typeof record.message === 'string'
          ? record.message
          : 'TikTok request failed';
  return `${code}: ${message.slice(0, 300)}`;
}

export function createTikTokOAuthState(socialPageId: string) {
  const config = getTikTokOAuthConfig();
  const state: TikTokOAuthState = {
    social_page_id: socialPageId,
    ts: Date.now(),
  };
  const payload = toBase64Url(JSON.stringify(state));
  const signature = signStatePayload(payload, config.stateSecret);
  return `${payload}.${signature}`;
}

export function verifyTikTokOAuthState(rawState: string): TikTokOAuthState {
  const config = getTikTokOAuthConfig();
  const [payload, signature] = rawState.split('.');
  if (!payload || !signature) throw new Error('Invalid OAuth state');

  const expectedSignature = signStatePayload(payload, config.stateSecret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid OAuth state');
  }

  const state = JSON.parse(fromBase64Url(payload)) as TikTokOAuthState;
  if (!state.social_page_id || !state.ts) throw new Error('Invalid OAuth state');
  if (Date.now() - state.ts > 15 * 60 * 1000) throw new Error('OAuth state expired');
  return state;
}

export function buildTikTokConnectUrl(socialPageId: string) {
  const config = getTikTokOAuthConfig();
  const params = new URLSearchParams({
    client_key: config.clientKey,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: TIKTOK_SCOPES.join(','),
    state: createTikTokOAuthState(socialPageId),
  });

  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeTikTokCodeForTokens(code: string) {
  const config = getTikTokOAuthConfig();
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.redirectUri,
    }),
  });

  const payload = await parseTikTokJson<TikTokTokenResponse>(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(sanitizeTikTokError(payload));
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    token_type: payload.token_type || 'Bearer',
    scope: payload.scope || TIKTOK_SCOPES.join(','),
    expires_at: expiresAtFromExpiresIn(payload.expires_in),
    metadata: {
      connected_at: new Date().toISOString(),
      source: 'tiktok_oauth_callback',
      open_id: payload.open_id || null,
      refresh_expires_at: expiresAtFromExpiresIn(payload.refresh_expires_in),
    },
  };
}

export async function storeTikTokOAuthTokens(
  supabase: SupabaseClient,
  socialPageId: string,
  tokenPayload: Awaited<ReturnType<typeof exchangeTikTokCodeForTokens>>,
) {
  return upsertSocialAccountToken(supabase, {
    social_page_id: socialPageId,
    provider: 'tiktok',
    access_token: tokenPayload.access_token,
    refresh_token: tokenPayload.refresh_token,
    token_type: tokenPayload.token_type,
    scope: tokenPayload.scope,
    expires_at: tokenPayload.expires_at,
    metadata: tokenPayload.metadata,
  });
}

export async function refreshTikTokAccessToken(
  supabase: SupabaseClient,
  token: SocialAccountToken,
) {
  if (!token.refresh_token) {
    throw new Error('TikTok token expired and refresh token is missing');
  }

  const config = getTikTokOAuthConfig();
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: config.clientKey,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
    }),
  });

  const payload = await parseTikTokJson<TikTokTokenResponse>(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(`TikTok token refresh failed: ${sanitizeTikTokError(payload)}`);
  }

  return updateSocialAccountToken(supabase, token.id, {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || token.refresh_token,
    token_type: payload.token_type || token.token_type,
    scope: payload.scope || token.scope,
    expires_at: expiresAtFromExpiresIn(payload.expires_in) || token.expires_at,
    metadata: {
      ...(token.metadata || {}),
      refreshed_at: new Date().toISOString(),
      refresh_expires_at:
        expiresAtFromExpiresIn(payload.refresh_expires_in) ||
        token.metadata?.refresh_expires_at ||
        null,
    },
  });
}

export async function getValidTikTokAccessToken(
  supabase: SupabaseClient,
  token: SocialAccountToken,
) {
  const validToken = await getValidTikTokToken(supabase, token);

  return validToken.access_token;
}

export async function getValidTikTokToken(
  supabase: SupabaseClient,
  token: SocialAccountToken,
) {
  return shouldRefreshToken(token)
    ? await refreshTikTokAccessToken(supabase, token)
    : token;
}

export function sanitizeTikTokCreatorInfo(
  value: TikTokCreatorInfoResponse['data'],
): SanitizedTikTokCreatorInfo {
  return {
    creator_avatar_url:
      typeof value?.creator_avatar_url === 'string' ? value.creator_avatar_url : null,
    creator_username:
      typeof value?.creator_username === 'string' ? value.creator_username : null,
    creator_nickname:
      typeof value?.creator_nickname === 'string' ? value.creator_nickname : null,
    privacy_level_options: Array.isArray(value?.privacy_level_options)
      ? value.privacy_level_options.filter((item): item is string => typeof item === 'string')
      : [],
    comment_disabled: typeof value?.comment_disabled === 'boolean' ? value.comment_disabled : null,
    duet_disabled: typeof value?.duet_disabled === 'boolean' ? value.duet_disabled : null,
    stitch_disabled: typeof value?.stitch_disabled === 'boolean' ? value.stitch_disabled : null,
    max_video_post_duration_sec:
      typeof value?.max_video_post_duration_sec === 'number'
        ? value.max_video_post_duration_sec
        : null,
  };
}

export async function queryTikTokCreatorInfo(accessToken: string) {
  const response = await fetch(TIKTOK_CREATOR_INFO_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
  });

  const payload = await parseTikTokJson<TikTokCreatorInfoResponse>(response);
  const errorCode = payload.error?.code;
  if (!response.ok || (errorCode && errorCode !== 'ok')) {
    throw new Error(sanitizeTikTokError(payload));
  }

  return sanitizeTikTokCreatorInfo(payload.data);
}

export async function storeTikTokCreatorInfo(
  supabase: SupabaseClient,
  token: SocialAccountToken,
  creatorInfo: SanitizedTikTokCreatorInfo,
) {
  return updateSocialAccountToken(supabase, token.id, {
    metadata: {
      ...(token.metadata || {}),
      creator_info: creatorInfo,
      creator_info_refreshed_at: new Date().toISOString(),
    },
  });
}
