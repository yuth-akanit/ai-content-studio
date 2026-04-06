import { NextRequest, NextResponse } from 'next/server';
import { getProfiles, createProfile } from '@/lib/repositories/profiles';
import { businessProfileSchema } from '@/lib/validators/generation';

export async function GET() {
  try {
    const profiles = await getProfiles();
    return NextResponse.json(profiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profiles';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = businessProfileSchema.parse(body);
    const profile = await createProfile(validated as Parameters<typeof createProfile>[0]);
    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create profile';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
