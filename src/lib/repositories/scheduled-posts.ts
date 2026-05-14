import { getSupabaseServerClient } from '@/lib/supabase/client';
import {
  createScheduledPostsSchema,
  listScheduledPostsQuerySchema,
  updateScheduledPostSchema,
} from '@/lib/validators/scheduled-posts';
import { z } from 'zod';

type CreateScheduledPostsInput = z.infer<typeof createScheduledPostsSchema>;
type ListScheduledPostsInput = z.infer<typeof listScheduledPostsQuerySchema>;
type UpdateScheduledPostInput = z.infer<typeof updateScheduledPostSchema>;

const TABLE = 'scheduled_posts';

function buildSelect(campaignFilter: boolean) {
  const contentRelation = campaignFilter
    ? 'generated_contents!inner(id,project_id,platform,content_type,topic,output_payload,created_at)'
    : 'generated_contents(id,project_id,platform,content_type,topic,output_payload,created_at)';

  return `
    *,
    ${contentRelation},
    inbox_channels(id,name,provider,external_id,meta),
    post_logs(id,status,post_external_id)
  `;
}

export async function listScheduledPosts(filters: ListScheduledPostsInput) {
  const db = getSupabaseServerClient();
  let query = db
    .from(TABLE)
    .select(buildSelect(Boolean(filters.campaign_id)))
    .order('scheduled_at', { ascending: false })
    .limit(filters.limit);

  if (filters.status) query = query.eq('status', filters.status);
  if (filters.content_id) query = query.eq('content_id', filters.content_id);
  if (filters.campaign_id) query = query.eq('generated_contents.project_id', filters.campaign_id);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list scheduled posts: ${error.message}`);
  return data || [];
}

export async function createScheduledPosts(input: CreateScheduledPostsInput) {
  const db = getSupabaseServerClient();
  const uniquePageIds = [...new Set(input.social_page_ids)];

  const [{ data: content, error: contentError }, { data: pages, error: pagesError }] = await Promise.all([
    db.from('generated_contents').select('id').eq('id', input.content_id).single(),
    db.from('inbox_channels').select('id').in('id', uniquePageIds),
  ]);

  if (contentError || !content) {
    throw new Error('Content not found');
  }

  if (pagesError) {
    throw new Error('Failed to validate social pages');
  }

  const foundPageIds = new Set((pages || []).map((page) => page.id));
  const missingPageId = uniquePageIds.find((id) => !foundPageIds.has(id));
  if (missingPageId) {
    throw new Error('One or more social pages were not found');
  }

  const rows = uniquePageIds.map((pageId) => {
    const publishPayload = {
      ...input.metadata.publish_payload,
      image_urls: input.metadata.publish_payload.image_urls || [],
      video_url: input.metadata.publish_payload.video_url || null,
      page_ids: [pageId],
      social_page_id: pageId,
      created_from: 'schedule_ui',
      snapshot_version: 1,
    };

    return {
      content_id: input.content_id,
      social_page_id: pageId,
      scheduled_at: input.scheduled_at,
      metadata: {
        ...input.metadata,
        publish_payload: publishPayload,
      },
    };
  });

  const { data, error } = await db
    .from(TABLE)
    .insert(rows)
    .select('*');

  if (error) throw new Error(`Failed to create scheduled posts: ${error.message}`);
  return data || [];
}

export async function updateScheduledPost(id: string, input: UpdateScheduledPostInput) {
  const db = getSupabaseServerClient();
  const { data: existing, error: existingError } = await db
    .from(TABLE)
    .select('id,status')
    .eq('id', id)
    .single();

  if (existingError || !existing) {
    throw new Error('Scheduled post not found');
  }

  if (input.scheduled_at && existing.status !== 'pending') {
    throw new Error('Only pending scheduled posts can be rescheduled');
  }

  if (input.status === 'cancelled' && !['pending', 'failed'].includes(existing.status)) {
    throw new Error('Only pending or failed scheduled posts can be cancelled');
  }

  const updates: Record<string, unknown> = {};
  if (input.scheduled_at) updates.scheduled_at = input.scheduled_at;
  if (input.status === 'cancelled') {
    updates.status = 'cancelled';
    updates.locked_at = null;
    updates.locked_by = null;
  }

  const { data, error } = await db
    .from(TABLE)
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update scheduled post: ${error.message}`);
  return data;
}
