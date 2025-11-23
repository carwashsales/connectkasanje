#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'hub';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  try {
    console.log('Using bucket:', BUCKET);
    // 1x1 PNG (transparent)
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    const buffer = Buffer.from(b64, 'base64');
    const key = `smoke/${Date.now()}-test.png`;

    console.log('Uploading test image to', key);
    const { data, error } = await supabase.storage.from(BUCKET).upload(key, buffer, { contentType: 'image/png', upsert: false });
    if (error) {
      console.error('Upload error:', error);
      process.exit(1);
    }
    console.log('Upload succeeded, path:', data.path);

    // Try public URL first
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    let publicUrl = urlData?.publicUrl || null;
    if (!publicUrl) {
      const { data: signed, error: signedErr } = await supabase.storage.from(BUCKET).createSignedUrl(data.path, 3600);
      if (signedErr) {
        console.error('Failed to create signed URL:', signedErr);
      } else {
        publicUrl = signed.signedUrl;
      }
    }

    console.log('Returned URL:', publicUrl);

    if (!publicUrl) {
      console.error('No URL available for uploaded object');
      process.exit(1);
    }

    // Try to fetch the URL
    console.log('Fetching URL to verify...');
    const res = await fetch(publicUrl, { method: 'GET' });
    console.log('Fetch status:', res.status, res.statusText);
    const ct = res.headers.get('content-type');
    console.log('Content-Type:', ct);
    if (res.ok) {
      console.log('Smoke upload verification succeeded. The file is reachable.');
      process.exit(0);
    } else {
      console.error('Smoke upload verification failed (non-200).');
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected error during smoke upload:', err);
    process.exit(1);
  }
})();
