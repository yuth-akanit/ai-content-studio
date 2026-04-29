import { getSupabaseServerClient } from '@/lib/supabase/client';
import { ContentProject } from '@/types/database';

const TABLE = 'content_projects';

export async function getCampaigns(profileId: string, fields: string = '*'): Promise<any[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .select(fields)
    .eq('business_profile_id', profileId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch campaigns: ${error.message}`);
  return data || [];
}

export async function getCampaignById(id: string): Promise<ContentProject | null> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch campaign: ${error.message}`);
  }
  return data;
}

export async function createCampaign(campaign: Omit<ContentProject, 'id' | 'created_at' | 'updated_at'>): Promise<ContentProject> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .insert(campaign)
    .select()
    .single();

  if (error) throw new Error(`Failed to create campaign: ${error.message}`);
  return data;
}

export async function updateCampaign(id: string, updates: Partial<ContentProject>): Promise<ContentProject> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update campaign: ${error.message}`);
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete campaign: ${error.message}`);
}
