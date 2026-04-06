import { NextRequest, NextResponse } from 'next/server';
import { generateAndSaveContent } from '@/lib/services/generation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.business_profile_id) {
      return NextResponse.json(
        { error: 'business_profile_id is required' },
        { status: 400 },
      );
    }

    if (!body.input) {
      return NextResponse.json(
        { error: 'input is required' },
        { status: 400 },
      );
    }

    const result = await generateAndSaveContent({
      business_profile_id: body.business_profile_id,
      project_id: body.project_id,
      input: body.input,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Generation error:', error);
    const message = error instanceof Error ? error.message : 'Generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
