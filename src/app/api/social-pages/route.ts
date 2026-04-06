import { getSupabaseServerClient } from '@/lib/supabase/client';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from('inbox_channels')
    .select('*')
    .order('name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
