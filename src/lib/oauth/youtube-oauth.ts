import { createHmac, timingSafeEqual } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  SocialAccountToken,
  updateSocialAccountToken,
  upsertSocialAccountToken,
} from '@/lib/repositories/social-account-tokens';

const YOUTUBE_UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload';
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REFRESH_SKEW_MS = 5 * 60 * 1000;

interface YouTubeOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
}

interface YouTubeOAuthState {
  social_page_id: string;
  return_to: string;
  ts: number;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

function getYouTubeOAuthConfig(): YouTubeOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  const stateSecret = process.env.INTERNAL_API_SECRET;

  if (!clientId || !clientSecret || !redirectUri || !stateSecret) {
    throw new Error('YouTube OAuth is not configured');
  }

  return { clientId, clientSecret, redirectUri, stateSecret };
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

function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/settings';
  return value;
}

function sanitizeGoogleError(payload: unknown) {
  if (!payload || typeof payload !== 'object') return 'Google OAuth request failed';
  const record = payload as Record<string, unknown>;
  const code = typeof record.error === 'string' ? record.error : 'oauth_error';
  const description =
    typeof record.error_description === 'string'
      ? record.error_description.slice(0, 300)
      : 'Google OAuth request failed';
  return `${code}: ${description}`;
}

export function createYouTubeOAuthState(socialPageId: string, returnTo?: string | null) {
  const config = getYouTubeOAuthConfig();
  const state: YouTubeOAuthState = {
    social_page_id: socialPageId,
    return_to: safeReturnTo(returnTo || null),
    ts: Date.now(),
  };
  const payload = toBase64Url(JSON.stringify(state));
  const signature = signStatePayload(payload, config.stateSecret);
  return `${payload}.${signature}`;
}

export function verifyYouTubeOAuthState(rawState: string): YouTubeOAuthState {
  const config = getYouTubeOAuthConfig();
  const [payload, signature] = rawState.split('.');
  if (!payload || !signature) throw new Error('Invalid OAuth state');

  const expectedSignature = signStatePayload(payload, config.stateSecret);
  const received = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Invalid OAuth state');
  }

  const state = JSON.parse(fromBase64Url(payload)) as YouTubeOAuthState;
  if (!state.social_page_id || !state.ts) throw new Error('Invalid OAuth state');
  if (Date.now() - state.ts > 15 * 60 * 1000) throw new Error('OAuth state expired');
  return {
    ...state,
    return_to: safeReturnTo(state.return_to),
  };
}

export function buildYouTubeConnectUrl(socialPageId: string, returnTo?: string | null) {
  const config = getYouTubeOAuthConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: YOUTUBE_UPLOAD_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: createYouTubeOAuthState(socialPageId, returnTo),
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

function expiresAtFromExpiresIn(expiresIn?: number) {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function parseGoogleTokenResponse(response: Response): Promise<GoogleTokenResponse> {
  return response.json().catch(() => ({}));
}

export async function exchangeYouTubeCodeForTokens(code: string) {
  const config = getYouTubeOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const payload = await parseGoogleTokenResponse(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(sanitizeGoogleError(payload));
  }

  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token || null,
    token_type: payload.token_type || null,
    scope: payload.scope || null,
    expires_at: expiresAtFromExpiresIn(payload.expires_in),
  };
}

export async function storeYouTubeOAuthTokens(
  supabase: SupabaseClient,
  socialPageId: string,
  tokenPayload: Awaited<ReturnType<typeof exchangeYouTubeCodeForTokens>>,
) {
  return upsertSocialAccountToken(supabase, {
    social_page_id: socialPageId,
    provider: 'youtube',
    access_token: tokenPayload.access_token,
    refresh_token: tokenPayload.refresh_token,
    token_type: tokenPayload.token_type,
    scope: tokenPayload.scope,
    expires_at: tokenPayload.expires_at,
    metadata: {
      connected_at: new Date().toISOString(),
      source: 'youtube_oauth_callback',
    },
  });
}

function shouldRefreshToken(token: SocialAccountToken) {
  if (!token.expires_at) return false;
  const expiresAtMs = Date.parse(token.expires_at);
  return Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now() + REFRESH_SKEW_MS;
}

export async function refreshYouTubeAccessToken(
  supabase: SupabaseClient,
  token: SocialAccountToken,
) {
  if (!token.refresh_token) {
    throw new Error('YouTube token expired and refresh token is missing');
  }

  const config = getYouTubeOAuthConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const payload = await parseGoogleTokenResponse(response);
  if (!response.ok || !payload.access_token) {
    throw new Error(`YouTube token refresh failed: ${sanitizeGoogleError(payload)}`);
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
    },
  });
}

export async function getValidYouTubeAccessToken(
  supabase: SupabaseClient,
  token: SocialAccountToken,
) {
  const validToken = shouldRefreshToken(token)
    ? await refreshYouTubeAccessToken(supabase, token)
    : token;

  return validToken.access_token;
}
