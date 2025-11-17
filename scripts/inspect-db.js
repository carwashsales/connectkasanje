const supabase = require('../src/supabase/server-client').default;

(async () => {
  try {
    console.log('Checking Supabase connection using service role...');
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, username, full_name, avatar_url').limit(5);
    if (pErr) {
      console.error('Error fetching profiles:', pErr.message || pErr);
    } else {
      console.log(`Profiles fetched: ${profiles.length}`);
      console.log(profiles);
    }

    const { data: posts, error: postErr } = await supabase.from('posts').select('id, user_id, body, created_at').limit(5).order('created_at', { ascending: false });
    if (postErr) {
      console.error('Error fetching posts:', postErr.message || postErr);
    } else {
      console.log(`Posts fetched: ${posts.length}`);
      console.log(posts);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
})();
