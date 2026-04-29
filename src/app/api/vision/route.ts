import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { image_urls, context_type } = await request.json();

    if (!image_urls || !Array.isArray(image_urls) || image_urls.length === 0) {
      return NextResponse.json(
        { error: 'image_urls array (base64 data URLs) is required' },
        { status: 400 },
      );
    }

    const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI_API_KEY not configured' },
        { status: 500 },
      );
    }

    const baseURL = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.AI_VISION_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';
    const isVideoContext = context_type === 'video';
    const systemPrompt = isVideoContext
      ? `You are a visual analysis assistant for a Thai HVAC/refrigeration service business marketing team.
The provided images are key frames extracted from the same video.
Analyze the frames and describe:
1. What is happening across the video scenes
2. The equipment, tools, technician actions, and visible problem/condition
3. Whether this looks like installation, cleaning, repair, inspection, or before/after work
4. The strongest marketing angle that honestly reflects the footage
5. Customer pain points, trust signals, and proof of work shown in the video

Respond in Thai. Be concise but concrete. Focus on what is visually evident from the video frames so the marketing copy clearly feels tied to this exact clip.`
      : `You are a visual analysis assistant for a Thai HVAC/refrigeration service business marketing team.
Analyze the provided image and describe:
1. What is shown in the image (objects, equipment, people, setting)
2. The condition of any equipment/appliances visible
3. Relevant service context (repair, installation, maintenance, before/after)
4. Suggested marketing angle based on the image
5. Emotional appeal or customer pain point the image could illustrate

Respond in Thai. Be concise but descriptive. Focus on elements useful for creating marketing content.`;
    const userText = isVideoContext
      ? 'วิเคราะห์ key frames จากวิดีโอนี้เพื่อใช้สร้างคอนเทนต์การตลาดที่อิงจากคลิปจริง:'
      : 'วิเคราะห์รูปภาพเหล่านี้เพื่อใช้สร้างคอนเทนต์การตลาด:';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: userText,
              },
              ...image_urls.map((url: string) => ({
                type: 'image_url',
                image_url: {
                  url: url,
                  detail: 'low',
                },
              })),
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vision API error:', errorText);
      return NextResponse.json(
        { error: `Vision analysis failed: ${response.status}` },
        { status: 500 },
      );
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error('Vision route error:', error);
    const message = error instanceof Error ? error.message : 'Vision analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
