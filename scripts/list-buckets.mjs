import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// dotenv does not load `.env.local` by default. Try `.env.local` first, then fallback
// to default `.env` if present.
dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function listBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Supabase error:', error);
      process.exit(1);
    }
    console.log('Buckets:');
    data.forEach(b => console.log('-', b.name));
  } catch (err) {
    console.error('Unexpected error listing buckets:', err);
    process.exit(1);
  }
}

listBuckets();
