import { getSupabaseServerClient } from '@/lib/supabase/client';
import { CONTENT_TYPES, GeneratedContent, PLATFORMS } from '@/types/database';

const TABLE = 'generated_contents';

export interface ContentFilters {
  platform?: string;
  content_type?: string;
  project_id?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export async function getContents(
  profileId: string,
  filters: ContentFilters = {},
  fields: string = '*'
): Promise<{ data: any[]; count: number }> {
  const db = getSupabaseServerClient();
  let query = db
    .from(TABLE)
    .select(fields, { count: 'exact' })
    .eq('business_profile_id', profileId)
    .order('created_at', { ascending: false });

  if (filters.platform) query = query.eq('platform', filters.platform);
  if (filters.content_type) query = query.eq('content_type', filters.content_type);
  if (filters.project_id) query = query.eq('project_id', filters.project_id);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) query = query.or(`topic.ilike.%${filters.search}%,service_type.ilike.%${filters.search}%`);

  const limit = filters.limit || 20;
  const offset = filters.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) throw new Error(`Failed to fetch contents: ${error.message}`);
  return { data: data || [], count: count || 0 };
}

export async function getContentById(id: string): Promise<GeneratedContent | null> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch content: ${error.message}`);
  }
  return data;
}

export async function createContent(content: Omit<GeneratedContent, 'id' | 'created_at' | 'updated_at'>): Promise<GeneratedContent> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .insert(content)
    .select()
    .single();

  if (error) throw new Error(`Failed to create content: ${error.message}`);
  return data;
}

export async function updateContent(id: string, updates: Partial<GeneratedContent>): Promise<GeneratedContent> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update content: ${error.message}`);
  return data;
}

export async function deleteContent(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete content: ${error.message}`);
}

export async function getContentStats(profileId: string): Promise<{
  total: number;
  byPlatform: Record<string, number>;
  byType: Record<string, number>;
  recentCount: number;
}> {
  const db = getSupabaseServerClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [totalResult, recentResult, platformResults, typeResults] = await Promise.all([
    db
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('business_profile_id', profileId),
    db
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('business_profile_id', profileId)
      .gte('created_at', sevenDaysAgo),
    Promise.all(
      PLATFORMS.map(async (platform) => {
        const result = await db
          .from(TABLE)
          .select('id', { count: 'exact', head: true })
          .eq('business_profile_id', profileId)
          .eq('platform', platform);

        return [platform, result] as const;
      }),
    ),
    Promise.all(
      CONTENT_TYPES.map(async (contentType) => {
        const result = await db
          .from(TABLE)
          .select('id', { count: 'exact', head: true })
          .eq('business_profile_id', profileId)
          .eq('content_type', contentType);

        return [contentType, result] as const;
      }),
    ),
  ]);

  const errors = [
    totalResult.error,
    recentResult.error,
    ...platformResults.map(([, result]) => result.error),
    ...typeResults.map(([, result]) => result.error),
  ].filter(Boolean);

  if (errors.length > 0) {
    throw new Error(`Failed to fetch content stats: ${errors[0]?.message}`);
  }

  const byPlatform = Object.fromEntries(
    platformResults
      .filter(([, result]) => (result.count || 0) > 0)
      .map(([platform, result]) => [platform, result.count || 0]),
  );

  const byType = Object.fromEntries(
    typeResults
      .filter(([, result]) => (result.count || 0) > 0)
      .map(([contentType, result]) => [contentType, result.count || 0]),
  );

  return {
    total: totalResult.count || 0,
    byPlatform,
    byType,
    recentCount: recentResult.count || 0,
  };
}
