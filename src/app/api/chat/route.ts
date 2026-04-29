import { getAIProvider } from '@/lib/ai/provider';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages are required' },
        { status: 400 },
      );
    }

    const provider = getAIProvider();
    const result = await provider.generate(
      [
        {
          role: 'system',
          content:
            'You are a helpful Thai AI assistant for a content studio application. Reply naturally in Thai unless the user explicitly asks for another language. Format answers for readability: use short paragraphs, numbered steps for processes, bullet points for options, and **bold** only for short emphasis. Avoid returning one long wall of text.',
        },
        ...messages,
      ],
      {
        temperature: 0.7,
        responseFormat: 'text',
      },
    );

    return NextResponse.json({
      role: 'assistant',
      content: result.content,
      model: result.model,
    });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    const message =
      error instanceof Error ? error.message : 'Something went wrong';
    const isAuthError =
      message.includes('401') ||
      message.toLowerCase().includes('incorrect api key') ||
      message.toLowerCase().includes('invalid api key');

    return NextResponse.json(
      {
        error: isAuthError
          ? 'AI API authentication failed. Please verify AI_API_KEY or OPENAI_API_KEY in .env.local.'
          : message,
      },
      { status: isAuthError ? 401 : 500 },
    );
  }
}
