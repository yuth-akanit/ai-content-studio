import { NextRequest, NextResponse } from 'next/server';
import { getCampaigns, createCampaign } from '@/lib/repositories/campaigns';
import { contentProjectSchema } from '@/lib/validators/generation';

export async function GET(request: NextRequest) {
  try {
    const profileId = request.nextUrl.searchParams.get('profile_id');
    if (!profileId) return NextResponse.json({ error: 'profile_id required' }, { status: 400 });
    const campaigns = await getCampaigns(profileId);
    return NextResponse.json(campaigns);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = contentProjectSchema.parse(body);
    const campaign = await createCampaign(validated as Parameters<typeof createCampaign>[0]);
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
