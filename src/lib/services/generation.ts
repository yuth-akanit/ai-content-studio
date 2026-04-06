import { GenerationInput, BusinessProfile, GeneratedContent, ContentOutput } from '@/types/database';
import { generateContent as aiGenerate } from '@/lib/ai/generate';
import { createContent } from '@/lib/repositories/content';
import { getProfileById } from '@/lib/repositories/profiles';
import { generationInputSchema } from '@/lib/validators/generation';

export interface GenerateContentRequest {
  business_profile_id: string;
  project_id?: string;
  input: GenerationInput;
}

export interface GenerateContentResponse {
  content: GeneratedContent;
  model: string;
}

function validateContent(output: ContentOutput, input: GenerationInput, profile: BusinessProfile): string[] {
  const errors: string[] = [];
  const textContext = `${output.headline || ''} ${output.caption_main || ''} ${output.body || ''}`.toLowerCase();
  
  // 1. Service Kewyord Check
  const serviceKeywords = [
    ...(profile.service_categories || []),
    input.service_type || ''
  ].filter(Boolean).map(s => s.toLowerCase());
  
  const hasService = serviceKeywords.some(kw => textContext.includes(kw));
  if (!hasService) errors.push('Missing service-related keywords');

  // 2. Location Check
  const locationKeywords = [
    ...(profile.service_areas || []),
    input.location || ''
  ].filter(Boolean).map(l => l.toLowerCase());
  
  const hasLocation = locationKeywords.some(loc => textContext.includes(loc)) || (output.service_areas && output.service_areas.length > 0);
  if (!hasLocation) errors.push('Missing location or service area mentions');

  // 3. CTA Check
  if (!output.cta || output.cta.length < 10) errors.push('CTA is missing or too short');

  // 4. First Comment Check (Facebook)
  if (input.platform === 'facebook' && (!output.first_comment || output.first_comment.length < 5)) {
    errors.push('Missing first comment for Facebook');
  }

  // 5. FAQ Check (SEO/AEO mode)
  const isSEO = input.content_goal === 'local_seo' || input.content_type === 'faq_content';
  if (isSEO) {
    const faqCount = (output.faq_section?.length || 0) + (output.faq?.length || 0);
    if (faqCount < 3) errors.push('SEO/AEO content requires at least 3 FAQ items');
  }

  // 6. Generic Check
  if (textContext.length < 50) errors.push('Content is too short or generic');
  if (textContext.includes('[') || textContext.includes(']')) errors.push('Content contains placeholders');

  return errors;
}

export async function generateAndSaveContent(
  request: GenerateContentRequest,
): Promise<GenerateContentResponse> {
  // 1. Validate input
  const validated = generationInputSchema.parse(request.input);

  // 2. Load business profile
  const profile = await getProfileById(request.business_profile_id);
  if (!profile) {
    throw new Error('Business profile not found');
  }

  // 3. Generate content via AI (single pass + validation logging)
  const result = await aiGenerate(profile, validated);
  const lastErrors = validateContent(result.output, validated, profile);
  if (lastErrors.length > 0) {
    console.warn(`Content validation warnings: ${lastErrors.join(', ')}`);
  }
  const attempts = 1;

  // 4. Save to database
  const saved = await createContent({
    business_profile_id: request.business_profile_id,
    project_id: request.project_id || null,
    platform: validated.platform,
    platform_variant: validated.platform_variant || null,
    content_type: validated.content_type,
    topic: validated.topic || null,
    service_type: validated.service_type || null,
    input_payload: validated,
    output_payload: result.output,
    language: validated.language,
    tone: validated.tone,
    content_goal: validated.content_goal || null,
    post_length: validated.post_length,
    asset_type: validated.asset_type || null,
    visual_direction: validated.visual_direction || null,
    platform_constraints: {
      validation_errors: lastErrors.length > 0 ? lastErrors : undefined,
      attempts
    },
    status: 'draft',
    model_name: result.model,
    prompt_version: result.promptVersion,
  });

  return {
    content: saved,
    model: result.model,
  };
}
