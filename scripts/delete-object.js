#!/usr/bin/env node
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

const argv = require('minimist')(process.argv.slice(2));
const bucket = argv.bucket || argv.b || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'hub';
const objectPath = argv.path || argv.p;

if (!objectPath) {
  console.error('Usage: node scripts/delete-object.js --bucket <bucket> --path "path/to/object.png"');
  process.exit(1);
}

(async () => {
  try {
    console.log('Deleting object', objectPath, 'from bucket', bucket);
    const { data, error } = await supabase.storage.from(bucket).remove([objectPath]);
    if (error) {
      console.error('Delete error:', error);
      process.exit(2);
    }
    console.log('Delete result:', data);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
