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
          access_token: 'IGAAZAvbtpZCxB1BZAFpNOF9sNEVfcVp6YkROeW5lVy03ZAFVsdERWZAUdMblBHTGozZAE9tODREZAThzekFmdS0zOS1wRUE4aWdmcUVQY1BfMmVjSzBraEpVWDRvOUNIY19CU1cxTXFlMGtnRHpiRHdMZAlY4X1ExVWJiOVMzNXdIMk5QawZDZD',
          fb_page_id: '1811371763155997',
          is_instagram: true
        }
      },
      {
        name: 'ช่างแอร์ บางนาตราด บางพลี',
        provider: 'facebook',
        external_id: '35452386951011683',
        meta: { 
          access_token: 'IGAAZAvbtpZCxB1BZAFo5OER0MTJIRV9XUm9aSlZAjMkpkeTFOLU5VVzVtOC1wWDlPc1B5YUk4WmE4ajNNd1VXaWRnM1M0bUZANTVM4Y3J3OTJmTmdXVXZAqMi1zdzhQT0dHU1JiNmExeGNBdDktVHI0bVJSUG9ub0ZAidW91UmdTZA3AwMAZDZD',
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
