import { BusinessProfile, GenerationInput, ContentOutput } from '@/types/database';
import { buildPrompt } from '@/lib/prompts/buildPrompt';
import { getAIProvider, AIMessage } from './provider';

export interface GenerationResult {
  output: ContentOutput;
  model: string;
  promptVersion: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function sanitizeJSONResponse(raw: string): string {
  let cleaned = raw.trim();
  // Remove markdown code block wrappers if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

function parseAndValidateOutput(raw: string, platform: string): ContentOutput {
  const cleaned = sanitizeJSONResponse(raw);
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse AI response as JSON. Raw response: ${cleaned.slice(0, 200)}...`);
  }

  // Ensure platform field
  const output: ContentOutput = {
    platform: platform as ContentOutput['platform'],
    ...parsed,
  } as ContentOutput;

  // Ensure variations is always an array
  if (!Array.isArray(output.variations)) {
    output.variations = [];
  }

  // Ensure hashtags is always an array
  if (output.hashtags && !Array.isArray(output.hashtags)) {
    output.hashtags = [];
  }

  return output;
}

export async function generateContent(
  profile: BusinessProfile,
  input: GenerationInput,
): Promise<GenerationResult> {
  const provider = getAIProvider();
  const { systemPrompt, userPrompt, promptVersion } = buildPrompt(profile, input);

  const messages: AIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const result = await provider.generate(messages);
  const output = parseAndValidateOutput(result.content, input.platform);

  return {
    output,
    model: result.model,
    promptVersion,
    usage: result.usage,
  };
}
