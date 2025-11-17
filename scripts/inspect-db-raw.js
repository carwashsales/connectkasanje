require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in env.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

(async () => {
  try {
    console.log('Using Supabase URL:', url);

    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, full_name, avatar_url').limit(10).order('full_name', { ascending: true });
    if (pErr) {
      console.error('Error fetching profiles:', pErr.message || pErr);
    } else {
      console.log(`Profiles fetched: ${profiles.length}`);
      console.dir(profiles, { depth: 2 });
    }

    const { data: posts, error: postErr } = await supabase.from('posts').select('id, user_id, body, created_at').limit(10).order('created_at', { ascending: false });
    if (postErr) {
      console.error('Error fetching posts:', postErr.message || postErr);
    } else {
      console.log(`Posts fetched: ${posts.length}`);
      console.dir(posts, { depth: 2 });
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
})();
