import { z } from 'zod';
import {
  SHORT_FORM_FORMATS,
  SHORT_FORM_PLATFORM_TARGETS,
} from '@/types/database';

export const shortFormStatusSchema = z.enum(['draft', 'active', 'paused', 'completed', 'archived']);

const optionalUrlSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'cta_url must be a valid URL');

export const createShortFormCampaignSchema = z.object({
  business_profile_id: z.string().uuid(),
  campaign_name: z.string().trim().min(1).max(160),
  platform_targets: z.array(z.enum(SHORT_FORM_PLATFORM_TARGETS)).min(1).default(['tiktok']),
  primary_platform: z.enum(SHORT_FORM_PLATFORM_TARGETS).default('tiktok'),
  campaign_type: z.string().trim().min(1).max(80).default('lead_gen'),
  service_type: z.string().trim().min(1).max(120),
  target_area: z.string().trim().min(1).max(180),
  content_angle: z.string().trim().min(1).max(240),
  cta_type: z.string().trim().min(1).max(80).default('line_lead'),
  cta_text: z.string().trim().min(1).max(240).default('ทัก LINE @paairservice เพื่อประเมินอาการ/เช็กคิว'),
  cta_url: optionalUrlSchema,
  utm_campaign: z.string().trim().min(1).max(120),
  posting_goal: z.string().trim().min(1).max(80).default('lead'),
  status: shortFormStatusSchema.default('draft'),
}).superRefine((value, ctx) => {
  if (!value.platform_targets.includes(value.primary_platform)) {
    ctx.addIssue({
      code: 'custom',
      path: ['primary_platform'],
      message: 'primary_platform must be included in platform_targets',
    });
  }
});

export const listShortFormCampaignsQuerySchema = z.object({
  profile_id: z.string().uuid(),
  status: shortFormStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const generateShortFormContentSchema = z.object({
  campaign_id: z.string().uuid().optional(),
  business_profile_id: z.string().uuid().optional(),
  platform_targets: z.array(z.enum(SHORT_FORM_PLATFORM_TARGETS)).min(1),
  primary_platform: z.enum(SHORT_FORM_PLATFORM_TARGETS),
  service_type: z.string().trim().min(1).max(120),
  target_area: z.string().trim().min(1).max(180),
  content_angle: z.string().trim().min(1).max(240),
  format: z.enum(SHORT_FORM_FORMATS),
  cta_text: z.string().trim().min(1).max(240).default('ทัก LINE @paairservice เพื่อประเมินอาการ/เช็กคิว'),
  cta_type: z.string().trim().min(1).max(80).default('line_lead'),
  cta_url: optionalUrlSchema,
  utm_campaign: z.string().trim().max(120).optional().default('short_form_campaign'),
  count: z.coerce.number().int().min(1).max(10).default(5),
}).superRefine((value, ctx) => {
  if (!value.platform_targets.includes(value.primary_platform)) {
    ctx.addIssue({
      code: 'custom',
      path: ['primary_platform'],
      message: 'primary_platform must be included in platform_targets',
    });
  }

  if (!value.campaign_id && !value.business_profile_id) {
    ctx.addIssue({
      code: 'custom',
      path: ['business_profile_id'],
      message: 'business_profile_id is required when campaign_id is not provided',
    });
  }
});

export function parseShortFormError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join('; ');
}
