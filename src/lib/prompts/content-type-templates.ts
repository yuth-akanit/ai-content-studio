import { ContentType } from '@/types/database';

export interface ContentTypeTemplate {
  type: ContentType;
  label: string;
  description: string;
  promptGuidance: string;
  requiredOutputFields: string[];
  suggestedStructure: string;
}

export const contentTypeTemplates: Record<ContentType, ContentTypeTemplate> = {
  promotion_post: {
    type: 'promotion_post',
    label: 'Promotion Post',
    description: 'Service promotion with clear offer and urgency',
    promptGuidance: `Create a promotional post that:
- Highlights the specific service/offer clearly
- Creates urgency or scarcity when appropriate
- Addresses the customer pain point directly
- Includes a clear, compelling call-to-action
- Feels authentic, not salesy`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Hook → Problem → Solution/Offer → Social proof → CTA',
  },
  educational_post: {
    type: 'educational_post',
    label: 'Educational Post',
    description: 'Teach customers something useful about their service needs',
    promptGuidance: `Create an educational post that:
- Shares practical, actionable knowledge
- Positions the business as an expert
- Addresses common customer misconceptions
- Builds trust through value-first content
- Ends with a soft CTA`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Hook question → Educational content → Expert tip → Soft CTA',
  },
  before_after_post: {
    type: 'before_after_post',
    label: 'Before/After Post',
    description: 'Showcase transformation from service work',
    promptGuidance: `Create a before/after post that:
- Describes the initial problem vividly
- Shows the transformation clearly
- Highlights the skill and care involved
- Includes specific details (not vague)
- Creates desire for the same result`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Before state → Challenge → Process hint → After result → CTA',
  },
  testimonial_post: {
    type: 'testimonial_post',
    label: 'Testimonial Post',
    description: 'Amplify customer reviews and satisfaction stories',
    promptGuidance: `Create a testimonial post that:
- Feels authentic and believable
- Highlights specific results or benefits
- Includes emotional elements
- Shows the customer's journey from problem to solution
- Reinforces trust signals`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Customer quote/story → Context → Result → Business response → CTA',
  },
  faq_content: {
    type: 'faq_content',
    label: 'FAQ Content',
    description: 'Answer common customer questions',
    promptGuidance: `Create FAQ content that:
- Addresses real customer concerns
- Provides clear, concise answers
- Uses natural language, not corporate speak
- Includes helpful context
- Removes barriers to purchase`,
    requiredOutputFields: ['title', 'body', 'faq_section'],
    suggestedStructure: 'Question → Direct answer → Additional context → Next step CTA',
  },
  review_reply: {
    type: 'review_reply',
    label: 'Review Reply',
    description: 'Professional reply to customer reviews',
    promptGuidance: `Create a review reply that:
- Thanks the customer sincerely
- Acknowledges specific points they mentioned
- Reinforces the positive experience or addresses concerns
- Shows personality without being generic
- Keeps it brief and professional`,
    requiredOutputFields: ['body'],
    suggestedStructure: 'Thank you → Specific acknowledgment → Forward-looking statement',
  },
  seo_snippet: {
    type: 'seo_snippet',
    label: 'SEO Snippet',
    description: 'Search engine optimized content snippet',
    promptGuidance: `Create an SEO snippet that:
- Targets local service keywords naturally
- Includes location references
- Has compelling meta description
- Uses proper heading structure
- Answers search intent directly`,
    requiredOutputFields: ['seo_title', 'meta_description', 'body'],
    suggestedStructure: 'SEO title → Meta description → H1 → Structured content',
  },
  blog_idea: {
    type: 'blog_idea',
    label: 'Blog Idea',
    description: 'Blog topic idea with angle and outline hints',
    promptGuidance: `Generate a blog idea that:
- Targets a real customer concern or search query
- Has a clear angle and value proposition
- Includes suggested title variations
- Outlines key points to cover
- Considers SEO potential`,
    requiredOutputFields: ['title', 'body'],
    suggestedStructure: 'Title options → Angle → Key points → Target keywords → CTA direction',
  },
  blog_outline: {
    type: 'blog_outline',
    label: 'Blog Outline',
    description: 'Structured blog post outline with sections',
    promptGuidance: `Create a blog outline that:
- Has a compelling title and introduction angle
- Structures content logically with H2/H3 sections
- Includes key points for each section
- Incorporates SEO keywords naturally
- Ends with a strong conclusion and CTA`,
    requiredOutputFields: ['title', 'h2_sections', 'intro_paragraph', 'cta'],
    suggestedStructure: 'Title → Intro → H2 sections with key points → Conclusion → CTA',
  },
  service_page_draft: {
    type: 'service_page_draft',
    label: 'Service Page Draft',
    description: 'Website service page content',
    promptGuidance: `Create a service page that:
- Leads with the customer's problem/need
- Clearly describes the service offering
- Includes trust signals and social proof
- Has strong, conversion-focused CTAs
- Is structured for SEO`,
    requiredOutputFields: ['title', 'seo_title', 'meta_description', 'h1', 'h2_sections', 'intro_paragraph', 'service_description', 'cta'],
    suggestedStructure: 'H1 → Intro → Service details → Benefits → Trust signals → FAQ → CTA',
  },
  campaign_idea: {
    type: 'campaign_idea',
    label: 'Campaign Idea',
    description: 'Multi-platform marketing campaign concept',
    promptGuidance: `Generate a campaign idea that:
- Has a clear theme and objective
- Spans multiple platforms
- Includes content angle suggestions per platform
- Considers the customer journey
- Has a timeline suggestion`,
    requiredOutputFields: ['title', 'body'],
    suggestedStructure: 'Campaign theme → Objective → Platform breakdown → Timeline → Success metrics',
  },
  broadcast_message: {
    type: 'broadcast_message',
    label: 'Broadcast Message',
    description: 'Short direct message for LINE/chat broadcast',
    promptGuidance: `Create a broadcast message that:
- Gets to the point immediately
- Creates urgency or value
- Has clear action/button CTA
- Reads well on mobile
- Feels personal, not spammy`,
    requiredOutputFields: ['title', 'body', 'compact_version', 'button_text', 'cta'],
    suggestedStructure: 'Greeting → Value/Offer → Urgency → CTA button',
  },
  short_video_script: {
    type: 'short_video_script',
    label: 'Short Video Script',
    description: 'TikTok/Reels video script with scene flow',
    promptGuidance: `Create a video script that:
- Opens with a 3-second attention hook
- Flows naturally scene by scene
- Includes on-screen text suggestions
- Keeps it under 60 seconds
- Has a clear CTA at the end`,
    requiredOutputFields: ['title', 'hook_3s', 'script_outline', 'scene_flow', 'cta'],
    suggestedStructure: 'Hook (3s) → Context (5s) → Main content → Reveal/Result → CTA',
  },
  offer_announcement: {
    type: 'offer_announcement',
    label: 'Offer Announcement',
    description: 'Special offer or deal announcement',
    promptGuidance: `Create an offer announcement that:
- States the offer clearly and prominently
- Creates urgency with time limits or scarcity
- Highlights the value/savings
- Addresses why now is the time to act
- Has multiple CTA options`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Attention hook → Offer details → Value proposition → Urgency → CTA',
  },
  seasonal_campaign: {
    type: 'seasonal_campaign',
    label: 'Seasonal Campaign Copy',
    description: 'Season-specific marketing content',
    promptGuidance: `Create seasonal campaign content that:
- Ties the service to the season naturally
- Creates seasonal urgency
- References relevant weather/conditions
- Includes preventive/proactive messaging
- Feels timely and relevant`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Seasonal hook → Relevance → Service tie-in → Preventive angle → CTA',
  },
  customer_reminder: {
    type: 'customer_reminder',
    label: 'Customer Reminder Message',
    description: 'Service reminder for existing customers',
    promptGuidance: `Create a customer reminder that:
- Feels helpful, not nagging
- References their past service
- Explains why maintenance matters now
- Offers easy rebooking
- Is brief and respectful`,
    requiredOutputFields: ['title', 'body', 'cta', 'button_text'],
    suggestedStructure: 'Personal greeting → Reminder context → Why now → Easy action → CTA',
  },
  trust_building_post: {
    type: 'trust_building_post',
    label: 'Trust-building Post',
    description: 'Post that builds credibility and trust',
    promptGuidance: `Create a trust-building post that:
- Showcases expertise or credentials
- Shares behind-the-scenes authenticity
- Highlights team, process, or quality standards
- Uses social proof effectively
- Builds long-term credibility`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Authority hook → Credibility evidence → Story/Example → Commitment → Soft CTA',
  },
  local_area_post: {
    type: 'local_area_post',
    label: 'Local Area Marketing Post',
    description: 'Hyper-local content targeting specific service areas',
    promptGuidance: `Create a local area post that:
- References the specific area/neighborhood
- Shows familiarity with local concerns
- Uses local landmarks or references naturally
- Targets local SEO keywords
- Builds local community trust`,
    requiredOutputFields: ['title', 'opening_hook', 'body', 'cta'],
    suggestedStructure: 'Local hook → Area-specific problem → Local solution → Community trust → CTA',
  },
};

export function getContentTypeTemplate(type: ContentType): ContentTypeTemplate {
  return contentTypeTemplates[type];
}
