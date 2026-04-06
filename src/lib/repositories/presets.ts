import { getSupabaseServerClient } from '@/lib/supabase/client';
import { PromptPreset, TonePreset, CTAPreset, PlatformPreset } from '@/types/database';

// Prompt Presets
export async function getPromptPresets(): Promise<PromptPreset[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('prompt_presets').select('*').order('name');
  if (error) throw new Error(`Failed to fetch prompt presets: ${error.message}`);
  return data || [];
}

export async function createPromptPreset(preset: Omit<PromptPreset, 'id' | 'created_at' | 'updated_at'>): Promise<PromptPreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('prompt_presets').insert(preset).select().single();
  if (error) throw new Error(`Failed to create prompt preset: ${error.message}`);
  return data;
}

export async function updatePromptPreset(id: string, updates: Partial<PromptPreset>): Promise<PromptPreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('prompt_presets').update(updates).eq('id', id).select().single();
  if (error) throw new Error(`Failed to update prompt preset: ${error.message}`);
  return data;
}

export async function deletePromptPreset(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db.from('prompt_presets').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete prompt preset: ${error.message}`);
}

// Tone Presets
export async function getTonePresets(): Promise<TonePreset[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('tone_presets').select('*').order('name');
  if (error) throw new Error(`Failed to fetch tone presets: ${error.message}`);
  return data || [];
}

export async function createTonePreset(preset: Omit<TonePreset, 'id' | 'created_at' | 'updated_at'>): Promise<TonePreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('tone_presets').insert(preset).select().single();
  if (error) throw new Error(`Failed to create tone preset: ${error.message}`);
  return data;
}

export async function updateTonePreset(id: string, updates: Partial<TonePreset>): Promise<TonePreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('tone_presets').update(updates).eq('id', id).select().single();
  if (error) throw new Error(`Failed to update tone preset: ${error.message}`);
  return data;
}

export async function deleteTonePreset(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db.from('tone_presets').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete tone preset: ${error.message}`);
}

// CTA Presets
export async function getCTAPresets(): Promise<CTAPreset[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('cta_presets').select('*').order('name');
  if (error) throw new Error(`Failed to fetch CTA presets: ${error.message}`);
  return data || [];
}

export async function createCTAPreset(preset: Omit<CTAPreset, 'id' | 'created_at' | 'updated_at'>): Promise<CTAPreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('cta_presets').insert(preset).select().single();
  if (error) throw new Error(`Failed to create CTA preset: ${error.message}`);
  return data;
}

export async function updateCTAPreset(id: string, updates: Partial<CTAPreset>): Promise<CTAPreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('cta_presets').update(updates).eq('id', id).select().single();
  if (error) throw new Error(`Failed to update CTA preset: ${error.message}`);
  return data;
}

export async function deleteCTAPreset(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db.from('cta_presets').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete CTA preset: ${error.message}`);
}

// Platform Presets
export async function getPlatformPresets(): Promise<PlatformPreset[]> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('platform_presets').select('*').order('platform');
  if (error) throw new Error(`Failed to fetch platform presets: ${error.message}`);
  return data || [];
}

export async function createPlatformPreset(preset: Omit<PlatformPreset, 'id' | 'created_at' | 'updated_at'>): Promise<PlatformPreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('platform_presets').insert(preset).select().single();
  if (error) throw new Error(`Failed to create platform preset: ${error.message}`);
  return data;
}

export async function updatePlatformPreset(id: string, updates: Partial<PlatformPreset>): Promise<PlatformPreset> {
  const db = getSupabaseServerClient();
  const { data, error } = await db.from('platform_presets').update(updates).eq('id', id).select().single();
  if (error) throw new Error(`Failed to update platform preset: ${error.message}`);
  return data;
}

export async function deletePlatformPreset(id: string): Promise<void> {
  const db = getSupabaseServerClient();
  const { error } = await db.from('platform_presets').delete().eq('id', id);
  if (error) throw new Error(`Failed to delete platform preset: ${error.message}`);
}
