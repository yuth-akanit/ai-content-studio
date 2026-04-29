import { z } from 'zod';
import { PLATFORMS, CONTENT_TYPES, POST_LENGTHS, TONES } from '@/types/database';

export const generationInputSchema = z.object({
  platform: z.enum(PLATFORMS),
  platform_variant: z.string().optional(),
  content_type: z.enum(CONTENT_TYPES),
  service_type: z.string().optional(),
  topic: z.string().optional(),
  pain_point: z.string().optional(),
  location: z.string().optional(),
  promotion_offer: z.string().optional(),
  tone: z.enum(TONES).default('professional'),
  target_audience: z.string().optional(),
  cta_style: z.string().optional(),
  language: z.string().default('th'),
  keyword: z.string().optional(),
  custom_notes: z.string().optional(),
  asset_type: z.string().optional(),
  post_length: z.enum(POST_LENGTHS).default('medium'),
  visual_direction: z.string().optional(),
  content_goal: z.string().optional(),
  image_urls: z.array(z.string()).optional(),
  video_url: z.string().optional(),
  image_analysis: z.string().optional(),
  video_analysis: z.string().optional(),
  video_transcript: z.string().optional(),
});

export type GenerationInputSchema = z.infer<typeof generationInputSchema>;

export const businessProfileSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  business_type: z.string().default('general_service'),
  description: z.string().optional(),
  tone_of_voice: z.string().default('professional'),
  brand_style: z.string().default('clean'),
  service_categories: z.array(z.string()).default([]),
  service_areas: z.array(z.string()).default([]),
  target_audience: z.array(z.string()).default([]),
  pain_points: z.array(z.string()).default([]),
  faq_knowledge: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).default([]),
  review_examples: z.array(z.object({
    text: z.string(),
    rating: z.number().optional(),
    source: z.string().optional(),
  })).default([]),
  trust_signals: z.array(z.string()).default([]),
  promotion_goals: z.array(z.string()).default([]),
  brand_keywords: z.array(z.string()).default([]),
  banned_words: z.array(z.string()).default([]),
  contact_phone: z.string().optional(),
  contact_line: z.string().optional(),
  contact_email: z.string().optional(),
  website_url: z.string().url().optional().or(z.literal('')),
  social_links: z.record(z.string(), z.string()).default({}),
  default_ctas: z.array(z.string()).default([]),
  default_language: z.string().default('th'),
  bilingual_enabled: z.boolean().default(false),
});

export type BusinessProfileSchema = z.infer<typeof businessProfileSchema>;

export const contentProjectSchema = z.object({
  business_profile_id: z.string().uuid(),
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional(),
  campaign_type: z.string().default('general'),
  status: z.enum(['active', 'paused', 'completed', 'archived']).default('active'),
});

export type ContentProjectSchema = z.infer<typeof contentProjectSchema>;
