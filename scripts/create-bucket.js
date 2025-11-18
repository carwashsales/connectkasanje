#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const argv = process.argv.slice(2);
const bucketName = argv[0] || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'public';
const publicFlag = argv.includes('--public') || (process.env.SUPABASE_BUCKET_PUBLIC === 'true');

(async () => {
  try {
    console.log(`Creating bucket '${bucketName}' (public=${publicFlag}) using ${SUPABASE_URL}`);
    const { data, error } = await supabase.storage.createBucket(bucketName, { public: publicFlag });
    if (error) {
      // Supabase may return a message when bucket already exists.
      if (error.message && /already exists/i.test(error.message)) {
        console.log(`Bucket '${bucketName}' already exists.`);
        process.exit(0);
      }
      console.error('Error creating bucket:', error);
      process.exit(1);
    }
    console.log('Bucket created:', data);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
