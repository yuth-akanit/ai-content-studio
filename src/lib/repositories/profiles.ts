import { getSupabaseServerClient } from '@/lib/supabase/client';
import { BusinessProfile } from '@/types/database';

const TABLE = 'business_profiles';

export async function getProfiles(): Promise<BusinessProfile[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
  return data || [];
}

export async function getProfileById(id: string): Promise<BusinessProfile | null> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch profile: ${error.message}`);
  }
  return data;
}

export async function getDefaultProfile(): Promise<BusinessProfile | null> {
  return getDefaultProfileByFields('*');
}

export async function getDefaultProfileByFields(fields: string): Promise<any | null> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .select(fields)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Failed to fetch default profile: ${error.message}`);
  }
  return data;
}

export async function createProfile(profile: Omit<BusinessProfile, 'id' | 'created_at' | 'updated_at'>): Promise<BusinessProfile> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .insert(profile)
    .select()
    .single();

  if (error) throw new Error(`Failed to create profile: ${error.message}`);
  return data;
}

export async function updateProfile(id: string, updates: Partial<BusinessProfile>): Promise<BusinessProfile> {
  const db = getSupabaseServerClient();
  const { data, error } = await db
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update profile: ${error.message}`);
  return data;
}

export async function deleteProfile(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db
    .from(TABLE)
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete profile: ${error.message}`);
}
