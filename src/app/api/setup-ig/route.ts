import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerClient();
    
    // Begin script

    const accounts = [
      {
        name: 'ช่างล้างแอร์ บางพลี บางโฉลง สมุทรปราการ',
        provider: 'facebook',
        external_id: '26508624952160629',
        meta: { 
          access_token: 'IGAAZAvbtpZCxB1BZAGJNQXFvQ2RxYnktdTNTRFptZAGsyZAzZAsLVo0X1pCNV9CUkF5RGd2bGw2NzNiY0huSWpwSDRQNzhJWVAta29sbUxpeC1VYnJBbTlRNHozMXZAtOG5QNV9yNnZAWT1laeUJub0tyZAi1rSWsxaXdreHJjQ0RoYk9lawZDZD',
          fb_page_id: '1811371763155997',
          is_instagram: true
        }
      },
      {
        name: 'ช่างแอร์ บางนาตราด บางพลี',
        provider: 'facebook',
        external_id: '35452386951011683',
        meta: { 
          access_token: 'IGAAZAvbtpZCxB1BZAFk0OGVia09PemdHdW1BTTE3bGZAhMGFIQUJBMmVwT014WXo4UEpmS2xpZAG9RRGlHclZA6d1RWV3F6TDV6cGl5Q1puR0FKVFpTcjhNcVpSTmtLVzBwTUt2NENUYi1nTDFkZAHlwWldMVzRSbk80ZAXhNLVdBYklpWQZDZD',
          fb_page_id: '1811371763155997',
          is_instagram: true
        }
      }
    ];

    const results = [];
    for (const acc of accounts) {
      // First try to select existing to update, or just insert
      const { data: existing } = await supabase
        .from('inbox_channels')
        .select('id')
        .eq('external_id', acc.external_id)
        .single();
        
      if (existing) {
        const { error } = await supabase.from('inbox_channels').update(acc).eq('id', existing.id);
        if (error) throw new Error(`Update error: ${error.message}`);
        results.push('updated ' + acc.name);
      } else {
        const { error } = await supabase.from('inbox_channels').insert([acc]);
        if (error) throw new Error(`Insert error: ${error.message}`);
        results.push('inserted ' + acc.name);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 200 });
  }
}
