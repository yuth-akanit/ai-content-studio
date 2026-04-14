import { Platform } from '@/types/database';

export interface PlatformRule {
  platform: Platform;
  description: string;
  outputFields: string[];
  style: string[];
  constraints: string[];
  maxLength?: number;
}

export const platformRules: Record<Platform, PlatformRule> = {
  facebook: {
    platform: 'facebook',
    description: 'Facebook Business Page post',
    outputFields: [
      'title', 'opening_hook', 'body', 'short_version', 'medium_version',
      'long_version', 'cta', 'hashtags', 'suggested_comments', 'faq_section',
    ],
    style: [
      'Social and natural tone',
      'Not too formal, suitable for business page',
      'Can be medium or long form',
      'Trust-building and service promotion focused',
      'Use emojis sparingly for engagement',
    ],
    constraints: [
      'Keep under 2000 characters for best engagement',
      'Strong opening hook in first 2 lines',
      'Include clear call-to-action',
      'Hashtags: 8-10 relevant ones',
      'Generate 2-3 engaging suggested comments',
    ],
    maxLength: 2000,
  },
  instagram: {
    platform: 'instagram',
    description: 'Instagram post/carousel/reel/story',
    outputFields: [
      'title', 'opening_hook', 'body', 'short_version', 'cta',
      'hashtags', 'carousel_slides', 'on_image_text', 'suggested_comments', 'faq_section',
    ],
    style: [
      'Visual-first approach',
      'Strong first-line hook',
      'Modern and social-native feel',
      'Readable and natural',
      'Less bulky than Facebook posts',
    ],
    constraints: [
      'Caption under 2200 characters',
      'First line must be a strong hook',
      'Hashtags: 8-10 relevant ones',
      'Include on-image text suggestions for visual posts',
      'Carousel: 5-10 slides recommended',
    ],
    maxLength: 2200,
  },
  line_oa: {
    platform: 'line_oa',
    description: 'LINE Official Account broadcast/message',
    outputFields: [
      'title', 'body', 'compact_version', 'cta', 'button_text',
      'urgency_level', 'personalization_suggestion', 'faq_section',
    ],
    style: [
      'Concise and clear',
      'Action-oriented',
      'Chat/broadcast format suitable',
      'Optimized for quick mobile reading',
      'No long paragraph walls',
    ],
    constraints: [
      'Keep message body under 500 characters',
      'Include clear button text for CTA',
      'Specify urgency level (low/medium/high)',
      'Include personalization suggestion',
    ],
    maxLength: 500,
  },
  tiktok: {
    platform: 'tiktok',
    description: 'TikTok short-form video content',
    outputFields: [
      'title', 'hook_3s', 'script_outline', 'scene_flow',
      'on_image_text', 'body', 'cta', 'hashtags', 'suggested_comments', 'faq_section',
    ],
    style: [
      'High attention in first 3 seconds',
      'Conversational and relatable',
      'Mobile-first',
      'Short and punchy',
      'Support short-form video storytelling',
    ],
    constraints: [
      'Hook must grab attention in 3 seconds',
      'Caption under 300 characters',
      'Scene flow: 3-7 steps',
      'Include on-screen text overlay ideas',
      'Hashtags: 8-10 relevant ones',
    ],
    maxLength: 300,
  },
  line_voom: {
    platform: 'line_voom',
    description: 'LINE VOOM (Timeline) post',
    outputFields: ['title', 'body', 'cta', 'hashtags'],
    style: [
      'Visual and social tone',
      'Short and concise to avoid Read More truncation',
      'Use vertical layout with bullet points',
      'Emoji-rich for engagement',
    ],
    constraints: [
      'Caption under 1000 characters',
      'First 4 lines must be very engaging',
      'Include LINE OA contact link clearly',
      'Hashtags: 5-8 relevant ones',
    ],
    maxLength: 1000,
  },
  google_business: {
    platform: 'google_business',
    description: 'Google Business Profile (GMB) post',
    outputFields: ['title', 'body', 'cta'],
    style: [
      'Professional and informative',
      'Local-SEO focused',
      'Action-oriented (Reserve/Call/Learn More)',
      'Clear value proposition',
    ],
    constraints: [
      'Best length is 150-300 characters',
      'Include keywords for local search',
      'Clear call to action with phone number',
      'Avoid high-frequency emojis, keep it professional',
    ],
    maxLength: 1500,
  },
  website: {
    platform: 'website',
    description: 'Website service page / landing page / blog content',
    outputFields: [
      'title', 'seo_title', 'meta_description', 'h1', 'h2_sections',
      'intro_paragraph', 'service_description', 'trust_section',
      'cta', 'faq_section',
    ],
    style: [
      'SEO-friendly structure',
      'Trustworthy and professional',
      'Clear and conversion-focused',
      'Localized for service area',
      'Suitable for service business websites',
    ],
    constraints: [
      'SEO title under 60 characters',
      'Meta description under 160 characters',
      'Include H2 section structure with FAQ/AEO optimization (direct answers to specific questions)',
      'Include FAQ section when relevant',
      'Use local keywords naturally',
    ],
  },
  other: {
    platform: 'other',
    description: 'Custom platform content',
    outputFields: [
      'title', 'body', 'cta', 'variations', 'faq_section',
    ],
    style: [
      'Consistent with brand tone',
      'Adaptable format',
      'User-defined constraints respected',
    ],
    constraints: [
      'Follow user-specified format',
      'Keep structure reusable',
    ],
  },
};

export function getPlatformRule(platform: Platform): PlatformRule {
  return platformRules[platform] || platformRules.other;
}

export function getPlatformOutputFieldsText(platform: Platform): string {
  const rule = getPlatformRule(platform);
  return rule.outputFields.map(f => `"${f}"`).join(', ');
}
