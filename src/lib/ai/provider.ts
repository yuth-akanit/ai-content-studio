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

    const response = await fetch(`${cfg.baseURL || 'https://api.openai.com/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cfg.apiKey}`,
      },
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

export function getAIProvider(): AIProvider {
  if (providerInstance) return providerInstance;

  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const baseURL = process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    throw new Error('AI_API_KEY or OPENAI_API_KEY environment variable is required');
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
