#!/usr/bin/env node
/*
  Smoke test for posting and messaging flows.
  - Loads .env.local via dotenv
  - Uses SUPABASE_SERVICE_ROLE_KEY to perform admin operations
  - Creates a temporary user, verifies profile creation, inserts a post, inserts a conversation+message, then cleans up

  Usage: node scripts/smoke-test.js
*/

// Try loading .env.local first (common for Next.js), fallback to .env
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL in environment. Aborting.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function run() {
  const timestamp = Date.now();
  const email = `smoke+${timestamp}@example.com`;
  const password = `Testpass!${timestamp}`;

  console.log('Creating test user:', email);
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    console.error('Failed to create user:', createError.message || createError);
    process.exit(1);
  }
  const user = createData.user || createData;
  console.log('Created user id:', user.id);

  try {
    // Wait briefly for auth trigger to create profile
    await new Promise((r) => setTimeout(r, 2000));

    // Verify profile exists
    const { data: profiles, error: pErr } = await admin.from('profiles').select('*').eq('id', user.id).limit(1);
    if (pErr) throw pErr;
    console.log('Profile row found:', profiles && profiles.length ? 'yes' : 'no');

    // Create a post as this user (server-admin)
    const post = {
      user_id: user.id,
      body: 'Smoke test post ' + timestamp,
      metadata: { smoke: true },
      visibility: 'public'
    };
    const { data: postData, error: postErr } = await admin.from('posts').insert([post]).select().single();
    if (postErr) throw postErr;
    console.log('Created post id:', postData.id);

    // Create a conversation and message
    const { data: convData, error: convErr } = await admin.from('conversations').insert([{ subject: 'Smoke', last_message_text: 'hi', last_message_at: new Date().toISOString() }]).select().single();
    if (convErr) throw convErr;
    console.log('Created conversation id:', convData.id);

    const { data: msgData, error: msgErr } = await admin.from('messages').insert([{ conversation_id: convData.id, sender_id: user.id, recipient_id: user.id, text: 'Smoke message', created_at: new Date().toISOString() }]).select().single();
    if (msgErr) throw msgErr;
    console.log('Created message id:', msgData.id);

    // Verify selects
    const { data: postCheck } = await admin.from('posts').select('*').eq('id', postData.id).limit(1);
    console.log('Post accessible via admin client:', postCheck && postCheck.length ? 'yes' : 'no');

    // Cleanup: delete message, conversation, post, profile, and user
    console.log('Cleaning up created rows...');
    await admin.from('messages').delete().eq('id', msgData.id);
    await admin.from('conversations').delete().eq('id', convData.id);
    await admin.from('posts').delete().eq('id', postData.id);
    await admin.from('profiles').delete().eq('id', user.id);
    await admin.auth.admin.deleteUser(user.id);
    console.log('Cleanup complete. Smoke test succeeded.');
  } catch (err) {
    console.error('Smoke test failed:', err);
    try {
      console.log('Attempting to delete user for cleanup...');
      if (user && user.id) await admin.auth.admin.deleteUser(user.id);
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

run().catch((err) => { console.error('Unhandled error in smoke test', err); process.exit(1); });
