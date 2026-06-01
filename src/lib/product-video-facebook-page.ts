import { getSupabaseServerClient } from '@/lib/supabase/client';

export interface ProductVideoSelectedFacebookPage {
  selected_channel_id: string;
  selected_page_id: string;
  selected_page_name: string;
  external_id: string;
  facebook_page_id: string;
  provider: 'facebook';
  status: 'active';
  page_access_token: string;
}

interface InboxChannelRow {
  id?: unknown;
  name?: unknown;
  provider?: unknown;
  external_id?: unknown;
  status?: unknown;
  meta?: unknown;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getMetaAccessToken(meta: unknown): string {
  if (!isRecord(meta)) return '';
  return cleanText(meta.access_token);
}

function assertSafeSelector(selector: string): void {
  if (!selector || !/^[A-Za-z0-9_-]+$/.test(selector)) {
    throw Object.assign(new Error('selected_facebook_page_id_invalid'), {
      code: 'selected_facebook_page_id_invalid',
      status: 400,
    });
  }
}

function isUuidSelector(selector: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(selector);
}

function normalizeFacebookPage(row: InboxChannelRow | null): ProductVideoSelectedFacebookPage {
  const id = cleanText(row?.id);
  const name = cleanText(row?.name);
  const provider = cleanText(row?.provider).toLowerCase();
  const status = cleanText(row?.status).toLowerCase();
  const externalId = cleanText(row?.external_id);
  const token = getMetaAccessToken(row?.meta);

  if (!id) {
    throw Object.assign(new Error('selected_facebook_page_not_found'), {
      code: 'selected_facebook_page_not_found',
      status: 404,
    });
  }
  if (provider !== 'facebook') {
    throw Object.assign(new Error('selected_facebook_page_provider_invalid'), {
      code: 'selected_facebook_page_provider_invalid',
      status: 409,
    });
  }
  if (status !== 'active') {
    throw Object.assign(new Error('selected_facebook_page_inactive'), {
      code: 'selected_facebook_page_inactive',
      status: 409,
    });
  }
  if (!externalId) {
    throw Object.assign(new Error('selected_facebook_page_external_id_missing'), {
      code: 'selected_facebook_page_external_id_missing',
      status: 409,
    });
  }
  if (!token) {
    throw Object.assign(new Error('selected_facebook_page_access_token_missing'), {
      code: 'selected_facebook_page_access_token_missing',
      status: 409,
    });
  }

  return {
    selected_channel_id: id,
    selected_page_id: id,
    selected_page_name: name || externalId,
    external_id: externalId,
    facebook_page_id: externalId,
    provider: 'facebook',
    status: 'active',
    page_access_token: token,
  };
}

export async function resolveProductVideoSelectedFacebookPage(
  selectedPageIdOrChannelId: string,
): Promise<ProductVideoSelectedFacebookPage> {
  const selector = cleanText(selectedPageIdOrChannelId);
  assertSafeSelector(selector);

  const supabase = getSupabaseServerClient();
  const selectColumns = 'id,name,provider,external_id,status,meta';

  if (isUuidSelector(selector)) {
    const { data: byId, error: byIdError } = await supabase
      .from('inbox_channels')
      .select(selectColumns)
      .eq('id', selector)
      .maybeSingle();

    if (byIdError) {
      throw Object.assign(new Error('selected_facebook_page_lookup_failed'), {
        code: 'selected_facebook_page_lookup_failed',
        status: 500,
      });
    }

    if (byId) return normalizeFacebookPage(byId as InboxChannelRow);
  }

  const { data: byExternalId, error: byExternalIdError } = await supabase
    .from('inbox_channels')
    .select(selectColumns)
    .eq('external_id', selector)
    .maybeSingle();

  if (byExternalIdError) {
    throw Object.assign(new Error('selected_facebook_page_lookup_failed'), {
      code: 'selected_facebook_page_lookup_failed',
      status: 500,
    });
  }

  return normalizeFacebookPage((byExternalId || null) as InboxChannelRow | null);
}

export function redactProductVideoFacebookPage(
  page: ProductVideoSelectedFacebookPage,
): Omit<ProductVideoSelectedFacebookPage, 'page_access_token'> & { page_access_token_present: true } {
  const { page_access_token: _token, ...safePage } = page;
  return {
    ...safePage,
    page_access_token_present: true,
  };
}
