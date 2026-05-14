import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  ContentProject,
  ShortFormCampaignMetadata,
} from '@/types/database';
import { z } from 'zod';
import {
  createShortFormCampaignSchema,
  listShortFormCampaignsQuerySchema,
} from '@/lib/validators/short-form-campaigns';

type CreateShortFormCampaignInput = z.infer<typeof createShortFormCampaignSchema>;
type ListShortFormCampaignsInput = z.infer<typeof listShortFormCampaignsQuerySchema>;

export interface ShortFormCampaignListItem extends Omit<ContentProject, 'metadata'> {
  metadata: ShortFormCampaignMetadata;
  generated_content_count: number;
  next_scheduled_at: string | null;
}

export async function createShortFormCampaign(input: CreateShortFormCampaignInput): Promise<ContentProject> {
  const db = getSupabaseServerClient();
  const metadata: ShortFormCampaignMetadata = {
    campaign_family: 'short_form',
    platform_targets: input.platform_targets,
    primary_platform: input.primary_platform,
    campaign_type: input.campaign_type,
    service_type: input.service_type,
    target_area: input.target_area,
    content_angle: input.content_angle,
    cta_type: input.cta_type,
    cta_text: input.cta_text,
    cta_url: input.cta_url,
    utm_source: 'short_form',
    utm_campaign: input.utm_campaign,
    posting_goal: input.posting_goal,
    status: input.status,
  };

  const { data, error } = await db
    .from('content_projects')
    .insert({
      business_profile_id: input.business_profile_id,
      name: input.campaign_name,
      description: `${input.service_type} / ${input.target_area} / ${input.content_angle}`,
      campaign_type: 'short_form',
      status: input.status === 'draft' ? 'active' : input.status,
      metadata,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create short-form campaign: ${error.message}`);
  }

  return data;
}

export async function listShortFormCampaigns(filters: ListShortFormCampaignsInput): Promise<ShortFormCampaignListItem[]> {
  const db = getSupabaseServerClient();
  let query = db
    .from('content_projects')
    .select('*')
    .eq('business_profile_id', filters.profile_id)
    .eq('metadata->>campaign_family', 'short_form')
    .order('updated_at', { ascending: false })
    .limit(filters.limit);

  if (filters.status) {
    query = query.eq('metadata->>status', filters.status);
  }

  const { data: campaigns, error } = await query;
  if (error) {
    throw new Error(`Failed to list short-form campaigns: ${error.message}`);
  }

  const campaignIds = (campaigns || []).map((campaign) => campaign.id);
  if (campaignIds.length === 0) return [];

  const { data: contents, error: contentError } = await db
    .from('generated_contents')
    .select('id,project_id')
    .in('project_id', campaignIds);

  if (contentError) {
    throw new Error(`Failed to count short-form content: ${contentError.message}`);
  }

  const counts = new Map<string, number>();
  for (const content of contents || []) {
    if (!content.project_id) continue;
    counts.set(content.project_id, (counts.get(content.project_id) || 0) + 1);
  }

  const nextScheduled = new Map<string, string>();
  try {
    const { data: scheduledRows } = await db
      .from('scheduled_posts')
      .select('scheduled_at,generated_contents!inner(project_id)')
      .eq('status', 'pending')
      .gte('scheduled_at', new Date().toISOString())
      .in('generated_contents.project_id', campaignIds)
      .order('scheduled_at', { ascending: true });

    for (const row of scheduledRows || []) {
      const relation = row.generated_contents as { project_id?: string } | null;
      const projectId = relation?.project_id;
      if (projectId && !nextScheduled.has(projectId)) {
        nextScheduled.set(projectId, row.scheduled_at);
      }
    }
  } catch {
    // scheduled_posts may not be migrated yet in local/dev environments.
  }

  return (campaigns || []).map((campaign) => ({
    ...campaign,
    metadata: campaign.metadata as ShortFormCampaignMetadata,
    generated_content_count: counts.get(campaign.id) || 0,
    next_scheduled_at: nextScheduled.get(campaign.id) || null,
  }));
}
