const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually parse .env.local
const envPath = path.join(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) env[key.trim()] = value.join('=').trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateInstagramAccounts() {
  const accounts = [
    {
      name: 'ช่างล้างแอร์ บางพลี บางโฉลง สมุทรปราการ',
      provider: 'instagram',
      external_id: '26508624952160629',
      access_token: 'IGAAZAvbtpZCxB1BZAGJNQXFvQ2RxYnktdTNTRFptZAGsyZAzZAsLVo0X1pCNV9CUkF5RGd2bGw2NzNiY0huSWpwSDRQNzhJWVAta29sbUxpeC1VYnJBbTlRNHozMXZAtOG5QNV9yNnZAWT1laeUJub0tyZAi1rSWsxaXdreHJjQ0RoYk9lawZDZD',
      meta: { fb_page_id: '1811371763155997' }
    },
    {
      name: 'ช่างแอร์ บางนาตราด บางพลี',
      provider: 'instagram',
      external_id: '35452386951011683',
      access_token: 'IGAAZAvbtpZCxB1BZAFk0OGVia09PemdHdW1BTTE3bGZAhMGFIQUJBMmVwT014WXo4UEpmS2xpZAG9RRGlHclZA6d1RWV3F6TDV6cGl5Q1puR0FKVFpTcjhNcVpSTmtLVzBwTUt2NENUYi1nTDFkZAHlwWldMVzRSbk80ZAXhNLVdBYklpWQZDZD',
      meta: { fb_page_id: '1811371763155997' }
    }
  ];

  for (const account of accounts) {
    console.log(`Processing: ${account.name}`);
    const { data, error } = await supabase
      .from('inbox_channels')
      .upsert(
        {
          name: account.name,
          provider: account.provider,
          external_id: account.external_id,
          access_token: account.access_token,
          meta: account.meta,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'external_id' }
      );

    if (error) {
      console.error(`Error updating ${account.name}:`, error.message);
    } else {
      console.log(`Successfully updated ${account.name}`);
    }
  }
}

updateInstagramAccounts();
