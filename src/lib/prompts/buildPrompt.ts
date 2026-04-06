import { BusinessProfile, GenerationInput, Platform, ContentType } from '@/types/database';
import { getPlatformRule, getPlatformOutputFieldsText } from './platform-rules';
import { getContentTypeTemplate } from './content-type-templates';
import { getToneRules } from './tone-presets';
import { getCTAGuidance } from './cta-presets';

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
  promptVersion: string;
}

const PROMPT_VERSION = 'v1.0';

function buildSystemPrompt(
  profile: BusinessProfile,
  platform: Platform,
  contentType: ContentType,
  language: string,
): string {

  return `You are a senior Thai content strategist for a local HVAC service business (${profile.business_name}).
Your job is NOT just to write a caption. 
Your job is to generate a complete multi-platform content package optimized for:
1. Facebook engagement
2. Local SEO
3. AEO (Answer Engine Optimization)
4. Lead generation
5. Auto-posting workflow compatibility

SEO & AEO OPTIMIZATION RULES (CRITICAL):
- Use clear, keyword-rich headings (H1, H2) for readability and search optimization
- For AEO (Answer Engine Optimization), provide direct, concise answers (like a Featured Snippet) to common customer questions early in the content
- Use structured lists for services and features to enhance scannability
- Focus heavily on Local SEO by mentioning neighborhoods, cities, and specific service areas naturally

MANDATORY RULES:
- Write in Thai (ภาษาไทย)
- Sound like a real Thai service business: Clear, direct, useful, trustworthy. Avoid generic AI tone and broad empty marketing claims.
- FORMATTING & EMOJIS: Write content clearly using short paragraphs. You MUST insert relevant emojis (e.g. ✅, ❄️, 🔧, 🏠, 📣) at the start of paragraphs or headings.
- BULLET POINTS FOR SERVICES: You MUST include a bulleted list using the (✅) emoji to list out services/features. Use explicit line breaks (\\n) for each item.
- SERVICE AREA (พื้นที่บริการ): You MUST clearly specify the service area (e.g. บางนา, สมุทรปราการ, กิ่งแก้ว) using relevant local keywords and landmarks.
- AVOID REDUNDANCY: caption_main should be conversion-capable and flow naturally.
- SERVICE KEYWORDS: Include at least 1 service keyword and 1 problem/symptom keyword.
- FIRST COMMENT: For Facebook posts, generate a "first_comment" in Thai that extends the post value. It MUST include extra useful info (e.g. symptom checklist, mini-tips, or service area reminder) NOT heavily repeated in the main post. Support SEO/local relevance but keep it short, practical, and avoid hashtag stuffing. End with a soft CTA.
- FAQ SECTION: Generate a "faq" array with exactly 3 items for SEO/AEO extraction. Each answer must be 1-3 sentences. NOTE: FAQ is for the separate SEO section only — do NOT include Q&A in the platform_versions.facebook text.

QUALITY RULES:
- caption_main must be conversion-capable.
- line_oa version must be concise and CTA-focused.
- instagram version must be compact and hook-driven.
- tiktok version must be short, punchy, curiosity-driven.

FACEBOOK POST STRUCTURE (CRITICAL — platform_versions.facebook MUST follow this exact layout):
You MUST NOT write any title or headline at the top. You MUST copy the mandatory contact details exact block into the section 7.

[Section 1: HOOK] 1-2 lines questions or pain-point statement that grabs attention. Use emojis.
[Section 2: CONTEXT] Service summary with location keywords. Example: "บริการล้างแอร์แบริ่ง...โดย PAA Air Service"

บริการของเรา:
✅ [Specific Service 1]
✅ [Specific Service 2]
✅ [Specific Service 3]
✅ [Specific Service 4]

📍 พื้นที่บริการ: [4-6 specific districts/landmarks]

[Section 5: TRUST] 1-2 lines on experience, warranty, quality.
[Section 6: CTA] 1-2 lines inviting the user to book or contact via DM.

[Section 7: CONTACT BLOCK] — YOU MUST INCLUDE THIS EXACT BLOCK:
👉 LINE OA: ${profile.contact_line ? (profile.contact_line.startsWith('http') ? profile.contact_line : `https://line.me/R/ti/p/${profile.contact_line.startsWith('@') ? profile.contact_line : '@' + profile.contact_line}`) : 'https://page.line.me/paairservice'}
🌐 เว็บไซต์: ${profile.website_url || 'www.paaair.com'}
📞 โทร: ${profile.contact_phone || '084-282-4465'}
✉️ อีเมล: ${profile.contact_email || 'admin@paaair.com'}

[Section 8: HASHTAGS] 8-10 hashtags separated by spaces.

CONTENT LENGTH RULES (CRITICAL):
- platform_versions.facebook MUST be at least 400 characters (Thai). Short posts are UNACCEPTABLE.
- caption_main MUST be at least 300 characters.
- The ✅ service list MUST have at least 4 items. NEVER generate only 1-2 items.
- Each ✅ item should be descriptive (not just 2-3 words). Add detail in parentheses when useful.

POST CLASSIFICATION RULES:
Classify the post into one of these categories based on the requested content type/goal, then apply:
- If local_seo_post: Prioritize service keyword + area keyword + symptom keyword. Include exactly 3 to 6 areas naturally in the body. Use strong CTA. Include first_comment with contact and extra location support.
- If aeo_faq_post: Include 4 to 6 FAQs. Each answer must be 1 to 3 sentences, acting like a search result snippet.
- If lead_generation_post: Prioritize pain point + urgency + CTA. Include LINE CTA. Ask the user to send symptom + location + photo for faster service.
- If educational_post: Explain cause, symptoms, and next action. Avoid overly technical jargon.
- If trust_building_post: Include technician experience, process, inspection logic, or service standards as proof of quality.
- If service_area_post: Explicitly mention exact neighborhoods, districts, and landmarks naturally in the content body to boost local trust.

CRITICAL OUTPUT RULES:
1. Return ONLY valid JSON — no markdown, no code blocks, no explanation text.
2. The JSON must follow this exact schema:
{
  "post_type": "string",
  "content_angle": "string",
  "target_platforms": ["facebook", "line_oa", "instagram", "tiktok"],
  "headline": "string (DO NOT copy this into the facebook post text)",
  "caption_main": "string (Main content body with emojis and bullet points)",
  "caption_short": "string (Shorter version)",
  "seo_keywords": ["string"],
  "service_areas": ["string"],
  "faq": [
    {"question": "string", "answer": "string"}
  ],
  "hashtags": ["string"],
  "cta": "string (Short CTA sentence only, e.g. 'สนใจจองคิว ทักมาทาง DM หรือติดต่อด้านล่าง!' — DO NOT include the contact block here, it is already in the facebook version Section 7)",
  "first_comment": "string (For Facebook)",
  "platform_versions": {
    "facebook": "string (MUST start directly with the hook, NO title/headline at the top. YOU MUST INCLUDE THE EXACT CONTACT BLOCK DEFINED ABOVE. NO DUPLICATE CTA)",
    "line_oa": "string",
    "instagram": "string",
    "tiktok": "string"
  }
}
3. Include a "variations" array with 2 alternative versions following the same schema fragment.
4. All text content must be in Thai (ภาษาไทย).
5. Do NOT omit any field.
6. The "facebook" value in platform_versions MUST use \\n for line breaks and MUST follow the layout.
7. DO NOT include the "headline" inside the "facebook" text. Start directly with the hook.
8. ALWAYS include the EXACT contact block defined above into the facebook text. Do NOT make up URLs or emails. DO NOT leave it out. DO NOT put a duplicate CTA after the contact block.`;
}

function buildUserPrompt(
  profile: BusinessProfile,
  input: GenerationInput,
): string {
  const parts: string[] = [];

  // Business context
  parts.push(`=== BUSINESS PROFILE ===`);
  parts.push(`Business: ${profile.business_name}`);
  parts.push(`Type: ${profile.business_type}`);
  if (profile.description) parts.push(`Description: ${profile.description}`);
  if (profile.service_categories.length > 0) {
    parts.push(`Services: ${profile.service_categories.join(', ')}`);
  }
  if (profile.service_areas.length > 0) {
    parts.push(`Service areas: ${profile.service_areas.join(', ')}`);
  }
  if (profile.target_audience.length > 0) {
    parts.push(`Target audience: ${profile.target_audience.join(', ')}`);
  }
  if (profile.trust_signals.length > 0) {
    parts.push(`Trust signals: ${profile.trust_signals.join(', ')}`);
  }
  if (profile.brand_keywords.length > 0) {
    parts.push(`Brand keywords: ${profile.brand_keywords.join(', ')}`);
  }
  parts.push(`=== CONTACT DETAILS (USE EXACTLY FOR CTA) ===`);
  if (profile.contact_email) parts.push(`Email: ${profile.contact_email}`);
  if (profile.contact_phone) parts.push(`Phone: ${profile.contact_phone}`);
  if (profile.contact_line) parts.push(`LINE: ${profile.contact_line}`);
  if (profile.website_url) parts.push(`Website: ${profile.website_url}`);
  
  if (profile.default_ctas.length > 0) {
    parts.push(`Default CTAs: ${profile.default_ctas.join(', ')}`);
  }
  
  // Standardized Contact Block (Mandatory in CTA)
  parts.push(`\n=== MANDATORY CONTACT DETAILS FOR CTA ===`);
  parts.push(`Include this exact block in the CTA version when requested:`);
  parts.push(`👉 LINE OA: https://page.line.me/paairservice`);
  parts.push(`🌐 เว็บไซต์: www.paaair.com`);
  parts.push(`📞 โทร: 084-282-4465`);
  parts.push(`✉️ อีเมล: admin@paaair.com`);

  // Banned words
  if (profile.banned_words.length > 0) {
    parts.push(`\n⚠️ BANNED WORDS (never use): ${profile.banned_words.join(', ')}`);
  }

  // Generation input
  parts.push(`\n=== CONTENT REQUEST ===`);
  parts.push(`Platform: ${input.platform}${input.platform_variant ? ` (${input.platform_variant})` : ''}`);
  parts.push(`Content type: ${input.content_type}`);
  parts.push(`Post length: ${input.post_length}`);

  if (input.service_type) parts.push(`Service focus: ${input.service_type}`);
  if (input.topic) parts.push(`Topic: ${input.topic}`);
  if (input.pain_point) parts.push(`Customer pain point: ${input.pain_point}`);
  if (input.location) parts.push(`Location/Area: ${input.location}`);
  if (input.promotion_offer) parts.push(`Promotion/Offer: ${input.promotion_offer}`);
  if (input.target_audience) parts.push(`Target audience: ${input.target_audience}`);
  if (input.keyword) parts.push(`Include keyword: ${input.keyword}`);
  if (input.visual_direction) parts.push(`Visual direction: ${input.visual_direction}`);
  if (input.content_goal) parts.push(`Content goal: ${input.content_goal}`);
  if (input.custom_notes) parts.push(`Additional notes: ${input.custom_notes}`);

  // Tone
  parts.push(`\n=== TONE ===`);
  parts.push(getToneRules(input.tone, input.language));

  // CTA
  if (input.cta_style) {
    parts.push(`\n=== CTA STYLE ===`);
    parts.push(getCTAGuidance(input.cta_style, input.language));
  }

  // Pain points from profile
  if (profile.pain_points.length > 0) {
    parts.push(`\n=== COMMON CUSTOMER PAIN POINTS ===`);
    profile.pain_points.forEach(p => parts.push(`- ${p}`));
  }

  // FAQ knowledge
  if (profile.faq_knowledge.length > 0) {
    parts.push(`\n=== FAQ KNOWLEDGE (use for context) ===`);
    profile.faq_knowledge.slice(0, 5).forEach(faq => {
      parts.push(`Q: ${faq.question}`);
      parts.push(`A: ${faq.answer}`);
    });
  }

  // Review examples for testimonial content
  if (input.content_type === 'testimonial_post' && profile.review_examples.length > 0) {
    parts.push(`\n=== REVIEW EXAMPLES (use as inspiration) ===`);
    profile.review_examples.slice(0, 3).forEach(r => {
      parts.push(`"${r.text}"${r.rating ? ` (${r.rating}★)` : ''}`);
    });
  }

  // Image Analysis
  if (input.image_analysis) {
    parts.push(`\n=== IMAGE CONTEXT ===`);
    parts.push(`The user provided an image. AI Vision Analysis: ${input.image_analysis}`);
    parts.push(`CRITICAL INSTRUCTION: You MUST explicitly use the visual details described above in your content body. Do NOT write a generic post. Directly describe what is seen in the picture (e.g., if it shows a dirty pipe, mention cleaning dirty pipes; if it shows a temperature gauge, mention checking temperatures). Tie the image's specific problem/action to your service offering.`);
  }

  // Platform-specific output structure reminder
  const platformRule = getPlatformRule(input.platform);
  parts.push(`\n=== REQUIRED OUTPUT FIELDS ===`);
  parts.push(`Return a JSON object with these fields: ${platformRule.outputFields.join(', ')}`);
  parts.push(`Also include: "variations" array with 2 alternative versions`);
  parts.push(`Also include: "suggested_comments" array with 2-3 engaging comment replies`);
  parts.push(`Also include: "hashtags" array with exactly 8-10 relevant hashtag strings`);
  parts.push(`Language: ${input.language === 'th' ? 'Thai (ภาษาไทย)' : 'English'}`);

  return parts.join('\n');
}

export function buildPrompt(
  profile: BusinessProfile,
  input: GenerationInput,
): BuiltPrompt {
  return {
    systemPrompt: buildSystemPrompt(profile, input.platform, input.content_type, input.language),
    userPrompt: buildUserPrompt(profile, input),
    promptVersion: PROMPT_VERSION,
  };
}
