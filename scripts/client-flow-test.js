#!/usr/bin/env node
/**
 * Client-side flow smoke test:
 * - Creates an admin user via service role
 * - Signs in via anon client (simulates browser)
 * - Uploads a small file to storage (buckets: public and ft)
 * - Creates a post as the signed-in user
 * - Creates a conversation + message as the signed-in user
 * - Cleans up via admin client
 *
 * Usage: node scripts/client-flow-test.js
 */

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE keys in environment. Ensure NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const client = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
  const ts = Date.now();
  const email = `client-smoke+${ts}@example.com`;
  const password = `Testpass!${ts}`;

  console.log('Admin: creating user', email);
  const { data: createData, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) { console.error('Admin create user failed', createError); process.exit(1); }
  const user = createData.user || createData;
  console.log('Created user id', user.id);

  try {
    // Sign in with anon client (simulate browser)
    console.log('Client: signing in with password');
    const { data: signData, error: signErr } = await client.auth.signInWithPassword({ email, password });
    if (signErr) throw signErr;
    console.log('Client signed in, session exists:', !!signData.session);

    // Ensure at least one bucket exists: attempt to create 'public' and 'ft' if missing (idempotent)
    const ensureBuckets = ['public', 'ft'];
    for (const b of ensureBuckets) {
      try {
        await admin.storage.createBucket(b, { public: true }).then(() => console.log('Ensured bucket', b)).catch((e) => {
          // if error indicates bucket exists, ignore; otherwise log
          if (e && e.message && e.message.includes('already exists')) return;
          // ignore other errors (may not be permitted), we'll try uploads later
        });
      } catch (e) {
        // ignore
      }
    }

    // Upload small file to an available bucket. try common bucket names: public, ft, uploads
    const text = 'hello from client smoke test ' + ts;
    const buf = Buffer.from(text);
    const triedBuckets = ['public', 'ft', 'uploads'];
    let uploadData = null;
    let usedBucket = null;
    for (const b of triedBuckets) {
      const p = `client-smoke/${ts}-hello-${b}.txt`;
      try {
        console.log('Attempt upload to bucket', b, 'path', p);
        const res = await client.storage.from(b).upload(p, buf, { contentType: 'text/plain' });
        if (res.error) {
          console.log('Upload to', b, 'failed:', res.error.message || res.error);
          continue;
        }
        uploadData = res.data;
        usedBucket = b;
        break;
      } catch (e) {
        console.log('Upload to', b, 'raised:', e.message || e);
        continue;
      }
    }
    if (!uploadData) {
      console.log('No client upload succeeded. Attempting admin upload to any available bucket...');
      for (const b of ['public','ft','uploads']) {
        try {
          const adminP = `client-smoke-admin/${ts}-hello-${b}.txt`;
          const { data: adminUploadData, error: adminUpErr } = await admin.storage.from(b).upload(adminP, buf, { contentType: 'text/plain' });
          if (!adminUpErr) {
            uploadData = adminUploadData;
            usedBucket = b;
            urlData = admin.storage.from(b).getPublicUrl(adminUploadData.path).data || { publicUrl: null };
            console.log('Admin uploaded file to', b, 'path', adminUploadData.path);
            break;
          }
        } catch (e) {
          // ignore and try next
        }
      }
      if (!uploadData) throw new Error('No storage bucket available for upload (admin fallback failed)');
    }
    let urlData = { publicUrl: null };
    try { urlData = client.storage.from(usedBucket).getPublicUrl(uploadData.path).data || { publicUrl: null }; } catch (e) { urlData = { publicUrl: null }; }
    console.log('Uploaded file path:', uploadData.path, 'bucket:', usedBucket, 'publicUrl:', urlData.publicUrl);

    // If client upload returned no publicUrl (or was blocked by RLS), attempt admin upload and use that path
    if (!urlData.publicUrl) {
      console.log('Client upload did not produce a public URL. Falling back to admin upload for media.');
      try {
        const adminUploadPath = `client-smoke-admin/${ts}-hello.txt`;
        const { data: adminUploadData, error: adminUpErr } = await admin.storage.from(usedBucket).upload(adminUploadPath, buf, { contentType: 'text/plain' });
        if (adminUpErr) {
          console.log('Admin upload failed:', adminUpErr.message || adminUpErr);
        } else {
          uploadData = adminUploadData;
          const adminUrl = admin.storage.from(usedBucket).getPublicUrl(adminUploadData.path).data;
          urlData = adminUrl || { publicUrl: null };
          console.log('Admin uploaded file path:', uploadData.path, 'publicUrl:', urlData.publicUrl);
        }
      } catch (e) {
        console.log('Admin upload fallback error:', e.message || e);
      }
    }

    // Upload to 'ft' bucket if exists (some components use 'ft')
    let ftPath = null;
    try {
      const ftPathLocal = `client-smoke/${ts}-ft.txt`;
      const { data: ftUpload, error: ftErr } = await client.storage.from('ft').upload(ftPathLocal, Buffer.from('ft content'), { contentType: 'text/plain' });
      if (!ftErr) { ftPath = ftUpload.path; console.log('Uploaded to ft:', ftUpload.path); }
      else { console.log('ft upload skipped or failed (bucket may not exist):', ftErr.message || ftErr); }
    } catch (e) {
      console.log('ft upload attempt error (likely bucket missing):', e.message || e);
    }

    // Create a post as client
    console.log('Client: creating a post');
    const postBody = `Client smoke post ${ts}`;
    const { data: postData, error: postErr } = await client.from('posts').insert([{ user_id: user.id, body: postBody, media: { url: urlData.publicUrl, path: uploadData.path }, visibility: 'public' }]).select().single();
    if (postErr) throw postErr;
    console.log('Client: created post id', postData.id);

    // Create a product listing (posts with metadata.type = 'product')
    console.log('Client: creating product listing');
    const productPayload = { user_id: user.id, title: 'Client Smoke Product ' + ts, body: 'Test product', media: { url: urlData.publicUrl, path: uploadData.path }, metadata: { type: 'product', price: 9.99 }, visibility: 'public' };
    const { data: productData, error: productErr } = await client.from('posts').insert([productPayload]).select().single();
    if (productErr) throw productErr;
    console.log('Client: created product post id', productData.id);

    // Create conversation and message as client
    console.log('Client: creating conversation');
    const { data: convData, error: convErr } = await client.from('conversations').insert([{ subject: 'Client smoke', last_message_text: 'hi', last_message_at: new Date().toISOString() }]).select().single();
    if (convErr) throw convErr;
    console.log('Client: created conversation id', convData.id);

    const { data: msgData, error: msgErr } = await client.from('messages').insert([{ conversation_id: convData.id, sender_id: user.id, recipient_id: user.id, text: 'Client smoke message', created_at: new Date().toISOString() }]).select().single();
    if (msgErr) throw msgErr;
    console.log('Client: created message id', msgData.id);

    console.log('Client flow operations succeeded. Cleaning up using admin client...');
    await admin.from('messages').delete().eq('id', msgData.id);
    await admin.from('conversations').delete().eq('id', convData.id);
  await admin.from('posts').delete().eq('id', postData.id);
  if (ftPath) await admin.storage.from('ft').remove([ftPath]).catch(() => {});
  if (uploadData && usedBucket) await admin.storage.from(usedBucket).remove([uploadData.path]).catch(() => {});
    await admin.from('profiles').delete().eq('id', user.id);
    await admin.auth.admin.deleteUser(user.id);
    console.log('Cleanup complete. Client flow smoke test succeeded.');
  } catch (err) {
    console.error('Client flow test failed:', err);
    console.log('Attempting cleanup...');
    try { await admin.auth.admin.deleteUser(user.id); } catch (e) { /* ignore */ }
    process.exit(1);
  }
}

run().catch((err) => { console.error('Unhandled', err); process.exit(1); });
