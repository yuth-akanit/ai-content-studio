import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptPresets, createPromptPreset, updatePromptPreset, deletePromptPreset,
  getTonePresets, createTonePreset, updateTonePreset, deleteTonePreset,
  getCTAPresets, createCTAPreset, updateCTAPreset, deleteCTAPreset,
  getPlatformPresets, createPlatformPreset, updatePlatformPreset, deletePlatformPreset,
} from '@/lib/repositories/presets';

export async function GET(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    switch (type) {
      case 'prompt': return NextResponse.json(await getPromptPresets());
      case 'tone': return NextResponse.json(await getTonePresets());
      case 'cta': return NextResponse.json(await getCTAPresets());
      case 'platform': return NextResponse.json(await getPlatformPresets());
      default: return NextResponse.json({ error: 'type param required (prompt|tone|cta|platform)' }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;
    let result;
    switch (type) {
      case 'prompt': result = await createPromptPreset(data); break;
      case 'tone': result = await createTonePreset(data); break;
      case 'cta': result = await createCTAPreset(data); break;
      case 'platform': result = await createPlatformPreset(data); break;
      default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id, ...data } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    let result;
    switch (type) {
      case 'prompt': result = await updatePromptPreset(id, data); break;
      case 'tone': result = await updateTonePreset(id, data); break;
      case 'cta': result = await updateCTAPreset(id, data); break;
      case 'platform': result = await updatePlatformPreset(id, data); break;
      default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const type = request.nextUrl.searchParams.get('type');
    const id = request.nextUrl.searchParams.get('id');
    if (!type || !id) return NextResponse.json({ error: 'type and id required' }, { status: 400 });
    switch (type) {
      case 'prompt': await deletePromptPreset(id); break;
      case 'tone': await deleteTonePreset(id); break;
      case 'cta': await deleteCTAPreset(id); break;
      case 'platform': await deletePlatformPreset(id); break;
      default: return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
