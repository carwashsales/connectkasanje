import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  // It's okay to fail at runtime if env vars aren't set; keep this file simple.
  console.warn('Supabase URL or ANON key not set. Uploads will fail until these are provided.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
