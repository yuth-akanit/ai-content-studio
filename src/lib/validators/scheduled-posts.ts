import { z } from 'zod';

export const scheduledPostStatuses = [
  'pending',
  'processing',
  'posted',
  'failed',
  'cancelled',
] as const;

export const uuidSchema = z.string().uuid();

export const publishPayloadSnapshotSchema = z.object({
  message: z.string().trim().min(1).max(20000),
  image_urls: z.array(z.string()).default([]),
  video_url: z.string().nullable().optional().default(null),
  page_ids: z.array(uuidSchema).optional(),
  social_page_id: uuidSchema.optional(),
  created_from: z.literal('schedule_ui').default('schedule_ui'),
  snapshot_version: z.literal(1).default(1),
}).passthrough().superRefine((value, ctx) => {
  if (!value.social_page_id && (!value.page_ids || value.page_ids.length === 0)) {
    ctx.addIssue({
      code: 'custom',
      path: ['social_page_id'],
      message: 'publish_payload must include page_ids or social_page_id',
    });
  }
});

export const createScheduledPostsSchema = z.object({
  content_id: uuidSchema,
  social_page_ids: z.array(uuidSchema).min(1).max(25),
  scheduled_at: z.string().datetime({ offset: true }).refine((value) => {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && timestamp > Date.now();
  }, 'scheduled_at must be a valid future datetime'),
  metadata: z.object({
    publish_payload: publishPayloadSnapshotSchema,
  }).passthrough(),
});

export const listScheduledPostsQuerySchema = z.object({
  status: z.enum(scheduledPostStatuses).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  campaign_id: uuidSchema.optional(),
  content_id: uuidSchema.optional(),
});

export const updateScheduledPostSchema = z.object({
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  status: z.literal('cancelled').optional(),
}).refine((value) => value.scheduled_at || value.status, {
  message: 'scheduled_at or status is required',
}).refine((value) => {
  if (!value.scheduled_at) return true;
  const timestamp = Date.parse(value.scheduled_at);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}, 'scheduled_at must be a valid future datetime');

export const claimScheduledPostsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5),
  worker_id: z.string().trim().min(1).max(100).default('n8n-cron'),
});

export const markPostedSchema = z.object({
  post_log_id: uuidSchema.nullable().optional(),
});

export const markFailedSchema = z.object({
  error_message: z.string().trim().min(1).max(2000),
});

export function parseZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join('; ');
}
