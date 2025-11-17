require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, anon);

(async () => {
  try {
    // Attempt to insert a test post as if from client
    const testPost = {
      user_id: '00000000-0000-0000-0000-000000000000',
      body: 'test post from anon script ' + new Date().toISOString(),
      visibility: 'public',
      metadata: { likes: 0 }
    };
    const { data, error } = await supabase.from('posts').insert([testPost]);
    if (error) {
      console.error('Insert error (anon):', error.message || error);
    } else {
      console.log('Insert success (anon):', data);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
})();
