import { SupabaseClient } from '@supabase/supabase-js';

export type SocialAccountTokenProvider = 'youtube' | 'tiktok';

export interface SocialAccountToken {
  id: string;
  social_page_id: string;
  provider: SocialAccountTokenProvider;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface UpsertSocialAccountTokenInput {
  social_page_id: string;
  provider: SocialAccountTokenProvider;
  access_token: string;
  refresh_token?: string | null;
  token_type?: string | null;
  scope?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown>;
}

export async function getSocialAccountTokenByPageId(
  supabase: SupabaseClient,
  socialPageId: string,
  provider: SocialAccountTokenProvider,
): Promise<SocialAccountToken | null> {
  const { data, error } = await supabase
    .from('social_account_tokens')
    .select('id,social_page_id,provider,access_token,refresh_token,token_type,scope,expires_at,metadata,created_at,updated_at')
    .eq('social_page_id', socialPageId)
    .eq('provider', provider)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load ${provider} account token`);
  }

  return data as SocialAccountToken | null;
}

export async function upsertSocialAccountToken(
  supabase: SupabaseClient,
  input: UpsertSocialAccountTokenInput,
): Promise<SocialAccountToken> {
  const existing = await getSocialAccountTokenByPageId(supabase, input.social_page_id, input.provider);
  const row = {
    social_page_id: input.social_page_id,
    provider: input.provider,
    access_token: input.access_token,
    refresh_token: input.refresh_token ?? existing?.refresh_token ?? null,
    token_type: input.token_type ?? existing?.token_type ?? null,
    scope: input.scope ?? existing?.scope ?? null,
    expires_at: input.expires_at ?? existing?.expires_at ?? null,
    metadata: {
      ...(existing?.metadata || {}),
      ...(input.metadata || {}),
    },
  };

  const { data, error } = await supabase
    .from('social_account_tokens')
    .upsert(row, { onConflict: 'social_page_id,provider' })
    .select('id,social_page_id,provider,access_token,refresh_token,token_type,scope,expires_at,metadata,created_at,updated_at')
    .single();

  if (error) {
    throw new Error(`Failed to store ${input.provider} account token`);
  }

  return data as SocialAccountToken;
}

export async function updateSocialAccountToken(
  supabase: SupabaseClient,
  tokenId: string,
  updates: Partial<Pick<SocialAccountToken, 'access_token' | 'refresh_token' | 'token_type' | 'scope' | 'expires_at' | 'metadata'>>,
): Promise<SocialAccountToken> {
  const { data, error } = await supabase
    .from('social_account_tokens')
    .update(updates)
    .eq('id', tokenId)
    .select('id,social_page_id,provider,access_token,refresh_token,token_type,scope,expires_at,metadata,created_at,updated_at')
    .single();

  if (error) {
    throw new Error('Failed to update account token');
  }

  return data as SocialAccountToken;
}
