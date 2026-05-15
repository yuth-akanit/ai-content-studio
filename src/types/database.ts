// ============================================================
// Database row types matching the SQL schema
// ============================================================

export interface BusinessProfile {
  id: string;
  business_name: string;
  business_type: string;
  description: string | null;
  tone_of_voice: string;
  brand_style: string;
  service_categories: string[];
  service_areas: string[];
  target_audience: string[];
  pain_points: string[];
  faq_knowledge: FAQItem[];
  review_examples: ReviewExample[];
  trust_signals: string[];
  promotion_goals: string[];
  brand_keywords: string[];
  banned_words: string[];
  contact_phone: string | null;
  contact_line: string | null;
  contact_email: string | null;
  website_url: string | null;
  social_links: SocialLinks;
  default_ctas: string[];
  default_language: string;
  bilingual_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ReviewExample {
  text: string;
  rating?: number;
  source?: string;
}

export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  line?: string;
  youtube?: string;
  [key: string]: string | undefined;
}

export interface ContentProject {
  id: string;
  business_profile_id: string;
  name: string;
  description: string | null;
  campaign_type: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface GeneratedContent {
  id: string;
  business_profile_id: string;
  project_id: string | null;
  platform: Platform;
  platform_variant: string | null;
  content_type: ContentType;
  topic: string | null;
  service_type: string | null;
  input_payload: GenerationInput;
  output_payload: ContentOutput;
  language: string;
  tone: string;
  content_goal: string | null;
  post_length: string;
  asset_type: string | null;
  visual_direction: string | null;
  platform_constraints: Record<string, unknown>;
  status: 'draft' | 'saved' | 'published' | 'archived';
  metadata?: Record<string, unknown>;
  model_name: string | null;
  prompt_version: string;
  created_at: string;
  updated_at: string;
}

export interface PromptPreset {
  id: string;
  name: string;
  platform: string | null;
  content_type: string | null;
  system_prompt: string;
  user_prompt_template: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TonePreset {
  id: string;
  name: string;
  description: string | null;
  rules: string[];
  created_at: string;
  updated_at: string;
}

export interface CTAPreset {
  id: string;
  name: string;
  cta_style: string;
  examples: string[];
  created_at: string;
  updated_at: string;
}

export interface PlatformPreset {
  id: string;
  platform: string;
  variant: string | null;
  format_rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type ScheduledPostStatus = 'pending' | 'processing' | 'posted' | 'failed' | 'cancelled';

export interface ScheduledPostPublishPayload {
  message: string;
  image_urls: string[];
  video_url: string | null;
  page_ids?: string[];
  social_page_id?: string;
  created_from: 'schedule_ui';
  snapshot_version: 1;
  [key: string]: unknown;
}

export interface ScheduledPost {
  id: string;
  content_id: string;
  social_page_id: string;
  scheduled_at: string;
  status: ScheduledPostStatus;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  locked_at: string | null;
  locked_by: string | null;
  posted_at: string | null;
  post_log_id: string | null;
  metadata: {
    publish_payload?: ScheduledPostPublishPayload;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export type SocialAccountTokenProvider = 'youtube' | 'tiktok';

export interface SocialAccountToken {
  id: string;
  social_page_id: string;
  provider: SocialAccountTokenProvider;
  access_token: string;
  refresh_token: string | null;
  token_type: string | null;
  scope: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const SHORT_FORM_PLATFORM_TARGETS = ['tiktok', 'youtube_shorts', 'instagram_reels', 'facebook_reels'] as const;
export type ShortFormPlatformTarget = typeof SHORT_FORM_PLATFORM_TARGETS[number];

export const SHORT_FORM_FORMATS = [
  '15s_short',
  '30s_short',
  '45s_educational_short',
  'before_after_service_clip',
  'problem_solution_clip',
  'technician_advice_clip',
  'customer_faq_clip',
  'promo_offer_clip',
  'myth_busting_clip',
  'checklist_clip',
] as const;
export type ShortFormFormat = typeof SHORT_FORM_FORMATS[number];

export interface ShortFormCampaignMetadata {
  campaign_family: 'short_form';
  platform_targets: ShortFormPlatformTarget[];
  primary_platform: ShortFormPlatformTarget;
  campaign_type: string;
  service_type: string;
  target_area: string;
  content_angle: string;
  cta_type: string;
  cta_text: string;
  cta_url: string | null;
  utm_source: 'short_form';
  utm_campaign: string;
  posting_goal: string;
  status: string;
}

export interface ShortFormContentOutput {
  platform_targets: ShortFormPlatformTarget[];
  primary_platform: ShortFormPlatformTarget;
  format: ShortFormFormat;
  hook: string;
  script: string;
  shot_list: string[];
  caption_tiktok: string;
  caption_youtube_shorts: string;
  caption_instagram_reels?: string;
  caption_facebook_reels?: string;
  hashtags_tiktok: string[];
  hashtags_youtube_shorts: string[];
  hashtags_instagram_reels?: string[];
  hashtags_facebook_reels?: string[];
  cta: string;
  thumbnail_text: string;
  video_prompt: string;
  voiceover_style: string;
  compliance_notes: string[];
}

// ============================================================
// Enums and constants
// ============================================================

export const PLATFORMS = ['facebook', 'instagram', 'line_oa', 'line_voom', 'tiktok', 'google_business', 'website', 'other'] as const;
export type Platform = typeof PLATFORMS[number];

export const CONTENT_TYPES = [
  'promotion_post',
  'educational_post',
  'before_after_post',
  'testimonial_post',
  'faq_content',
  'review_reply',
  'seo_snippet',
  'blog_idea',
  'blog_outline',
  'service_page_draft',
  'campaign_idea',
  'broadcast_message',
  'short_video_script',
  'offer_announcement',
  'seasonal_campaign',
  'customer_reminder',
  'trust_building_post',
  'local_area_post',
] as const;
export type ContentType = typeof CONTENT_TYPES[number];

export const CONTENT_GOALS = [
  'lead_generation',
  'awareness',
  'reactivation',
  'trust_building',
  'promotions',
  'local_seo',
  'customer_education',
  'repeat_service_reminder',
  'testimonial_amplification',
] as const;
export type ContentGoal = typeof CONTENT_GOALS[number];

export const CAMPAIGN_TYPES = [
  'summer',
  'rainy_season',
  'emergency_repair',
  'preventive_maintenance',
  'customer_reactivation',
  'new_customer_acquisition',
  'songkran',
  'end_of_year',
  'general',
  'custom',
] as const;
export type CampaignType = typeof CAMPAIGN_TYPES[number];

export const POST_LENGTHS = ['short', 'medium', 'long'] as const;
export type PostLength = typeof POST_LENGTHS[number];

export const TONES = [
  'professional',
  'friendly',
  'casual',
  'urgent',
  'authoritative',
  'empathetic',
  'enthusiastic',
  'educational',
] as const;
export type Tone = typeof TONES[number];

export const BUSINESS_TYPES = [
  'hvac',
  'air_conditioning',
  'cleaning',
  'repair',
  'maintenance',
  'plumbing',
  'electrical',
  'pest_control',
  'landscaping',
  'moving',
  'home_service',
  'general_service',
] as const;
export type BusinessType = typeof BUSINESS_TYPES[number];

// ============================================================
// Generation types
// ============================================================

export interface GenerationInput {
  platform: Platform;
  platform_variant?: string;
  content_type: ContentType;
  service_type?: string;
  topic?: string;
  pain_point?: string;
  location?: string;
  promotion_offer?: string;
  tone: string;
  target_audience?: string;
  cta_style?: string;
  language: string;
  keyword?: string;
  custom_notes?: string;
  asset_type?: string;
  post_length: string;
  visual_direction?: string;
  content_goal?: string;
  image_urls?: string[];
  video_url?: string;
  image_analysis?: string;
  video_analysis?: string;
  video_transcript?: string;
}

export interface ContentOutput {
  platform: Platform;
  platform_variant?: string;
  content_type: string;
  title?: string;
  opening_hook?: string;
  body?: string;
  short_version?: string;
  medium_version?: string;
  long_version?: string;
  cta?: string;
  hashtags?: string[];
  seo_title?: string;
  seo_meta?: string;
  carousel_slides?: CarouselSlide[];
  on_image_text?: string[];
  scene_flow?: SceneStep[];
  button_text?: string;
  message_body?: string;
  compact_version?: string;
  urgency_level?: string;
  personalization_suggestion?: string;
  hook_3s?: string;
  script_outline?: string;
  h1?: string;
  h2_sections?: H2Section[];
  intro_paragraph?: string;
  service_description?: string;
  trust_section?: string;
  faq_section?: FAQItem[];
  meta_description?: string;
  variations?: ContentVariation[];
  suggested_comments?: string[];
  
  // New fields from master prompt
  post_type?: string;
  content_angle?: string;
  headline?: string;
  caption_main?: string;
  caption_short?: string;
  seo_keywords?: string[];
  service_areas?: string[];
  faq?: FAQItem[];
  first_comment?: string;
  platform_versions?: Partial<Record<Platform, string>>;
}

export interface CarouselSlide {
  slide_number: number;
  text: string;
  visual_suggestion?: string;
}

export interface SceneStep {
  step: number;
  description: string;
  on_screen_text?: string;
  duration_seconds?: number;
}

export interface H2Section {
  heading: string;
  content: string;
}

export interface ContentVariation {
  label: string;
  title?: string;
  opening_hook?: string;
  body?: string;
  cta?: string;
}

// ============================================================
// UI display helpers
// ============================================================

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  line_oa: 'LINE OA (Broadcast)',
  line_voom: 'LINE VOOM (Timeline)',
  tiktok: 'TikTok',
  google_business: 'Google Business',
  website: 'Website',
  other: 'Other Platform',
};

export const PLATFORM_VARIANTS: Record<Platform, string[]> = {
  facebook: ['post', 'story', 'ad', 'event'],
  instagram: ['post', 'carousel', 'reel', 'story'],
  line_oa: ['broadcast', 'rich_message', 'coupon'],
  line_voom: ['post', 'dynamic_video'],
  tiktok: ['short_video', 'duet_idea', 'series'],
  google_business: ['update', 'offer', 'event'],
  website: ['service_page', 'landing_page', 'blog', 'faq_page'],
  other: ['custom'],
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  promotion_post: 'Promotion Post',
  educational_post: 'Educational Post',
  before_after_post: 'Before/After Post',
  testimonial_post: 'Testimonial Post',
  faq_content: 'FAQ Content',
  review_reply: 'Review Reply',
  seo_snippet: 'SEO Snippet',
  blog_idea: 'Blog Idea',
  blog_outline: 'Blog Outline',
  service_page_draft: 'Service Page Draft',
  campaign_idea: 'Campaign Idea',
  broadcast_message: 'Broadcast Message',
  short_video_script: 'Short Video Script',
  offer_announcement: 'Offer Announcement',
  seasonal_campaign: 'Seasonal Campaign Copy',
  customer_reminder: 'Customer Reminder Message',
  trust_building_post: 'Trust-building Post',
  local_area_post: 'Local Area Marketing Post',
};

export const CONTENT_GOAL_LABELS: Record<ContentGoal, string> = {
  lead_generation: 'Lead Generation',
  awareness: 'Awareness',
  reactivation: 'Reactivation',
  trust_building: 'Trust Building',
  promotions: 'Promotions',
  local_seo: 'Local SEO',
  customer_education: 'Customer Education',
  repeat_service_reminder: 'Repeat Service Reminder',
  testimonial_amplification: 'Testimonial Amplification',
};
