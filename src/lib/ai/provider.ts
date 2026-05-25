export interface AIProviderConfig {
  apiKey: string;
  baseURL?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIGenerationResult {
  content: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIProvider {
  generate(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIGenerationResult>;
}

class OpenAICompatibleProvider implements AIProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async generate(messages: AIMessage[], overrides?: Partial<AIProviderConfig>): Promise<AIGenerationResult> {
    const cfg = { ...this.config, ...overrides };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    };

    if (cfg.baseURL?.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://studio.paaair.online';
      headers['X-Title'] = 'AI Content Studio';
    }

    const response = await fetch(`${cfg.baseURL || 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: cfg.model,
        messages,
        max_tokens: cfg.maxTokens || 4096,
        temperature: cfg.temperature ?? 0.7,
        ...(cfg.responseFormat === 'json_object'
          ? { response_format: { type: 'json_object' } }
          : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI provider error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    if (!choice?.message?.content) {
      throw new Error('No content in AI response');
    }

    return {
      content: choice.message.content,
      model: data.model || cfg.model,
      usage: data.usage,
    };
  }
}

let providerInstance: AIProvider | null = null;

/**
 * Mock provider used when real AI service is unavailable or when the
 * `MOCK_AI` environment variable is set to "true". It returns a static
 * placeholder response that satisfies the `AIProvider` interface.
 */
class MockProvider implements AIProvider {
  async generate(_messages: AIMessage[], _overrides?: Partial<AIProviderConfig>): Promise<AIGenerationResult> {
    return {
      content: '🤖 Mock response: AI service is unavailable (budget limit reached).',
      model: 'mock-model',
    };
  }
}

export function getAIProvider(): AIProvider {
  if (providerInstance) return providerInstance;

  // Enable mock mode via environment variable. This is useful during local
  // development when the external AI service hits its budget limit.
  if (process.env.MOCK_AI === 'true') {
    providerInstance = new MockProvider();
    return providerInstance;
  }

  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1';
  const model = process.env.AI_MODEL || (baseURL.includes('openrouter') ? 'openai/gpt-4o-mini' : 'gpt-4o-mini');

  if (!apiKey) {
    // If the key is missing, fall back to mock provider instead of throwing.
    providerInstance = new MockProvider();
    return providerInstance;
  }

  providerInstance = new OpenAICompatibleProvider({
    apiKey,
    baseURL,
    model,
    maxTokens: 4096,
    temperature: 0.7,
    responseFormat: 'json_object',
  });

  return providerInstance;
}

export function resetProvider(): void {
  providerInstance = null;
}
