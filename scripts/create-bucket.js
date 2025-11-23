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
// parse flags: --name NAME (multiple), --names name1,name2 or positional names
const namesFlagIndex = argv.findIndex(a => a === '--name' || a === '--names');
let bucketNames = [];
if (namesFlagIndex !== -1) {
  const val = argv[namesFlagIndex + 1] || '';
  bucketNames = val.split(',').map(s => s.trim()).filter(Boolean);
}
// collect positional names (non-flag args)
const positional = argv.filter(a => !a.startsWith('--'));
if (positional.length > 0) {
  // treat all positional args as bucket names unless they are consumed by --name value
  const consumed = namesFlagIndex !== -1 ? argv[namesFlagIndex + 1] : undefined;
  positional.forEach(p => {
    if (p !== consumed && p !== 'node' && p !== path.basename(process.argv[1])) bucketNames.push(p);
  });
}

// fallback to env or default
if (bucketNames.length === 0) {
  const envBucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET;
  bucketNames = [envBucket || 'hub'];
}

const publicFlag = argv.includes('--public') || (process.env.SUPABASE_BUCKET_PUBLIC === 'true');

(async () => {
  try {
    for (const name of bucketNames) {
      console.log(`Creating bucket '${name}' (public=${publicFlag}) using ${SUPABASE_URL}`);
      const { data, error } = await supabase.storage.createBucket(name, { public: publicFlag });
      if (error) {
        if (error.message && /already exists/i.test(error.message)) {
          console.log(`Bucket '${name}' already exists.`);
          continue;
        }
        console.error(`Error creating bucket '${name}':`, error);
        continue;
      }
      console.log('Bucket created:', data);
    }
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
