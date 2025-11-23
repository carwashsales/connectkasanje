#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const argv = require('minimist')(process.argv.slice(2));
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = argv.bucket || argv.b || process.env.NEXT_PUBLIC_SUPABASE_BUCKET || process.env.SUPABASE_BUCKET || 'hub';
const PREFIX = argv.prefix || argv.p || 'smoke/';
const HOURS = Number(argv.hours || argv.h || 24);

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

(async () => {
  try {
    console.log(`Cleaning objects in bucket='${BUCKET}' prefix='${PREFIX}' older than ${HOURS}h`);
    // Supabase storage.list returns up to 1000 by default. We'll page if needed.
    let offset = 0;
    const toDelete = [];
    const cutoff = Date.now() - (HOURS * 60 * 60 * 1000);

    while (true) {
      const { data, error } = await supabase.storage.from(BUCKET).list(PREFIX, { limit: 1000, offset });
      if (error) {
        console.error('List error:', error);
        process.exit(2);
      }
      if (!data || data.length === 0) break;

      data.forEach((obj) => {
        // Try common timestamp fields
        const updated = obj.updated_at || obj.last_modified || obj.created_at || obj.time_created;
        if (!updated) return; // skip if no timestamp
        const t = Date.parse(updated);
        if (!isNaN(t) && t < cutoff) {
          toDelete.push(obj.name || obj.id || obj.path);
        }
      });

      if (data.length < 1000) break;
      offset += data.length;
    }

    if (toDelete.length === 0) {
      console.log('No objects to delete.');
      process.exit(0);
    }

    console.log('Objects to delete count:', toDelete.length);
    // Supabase remove accepts up to 1000 paths at once
    const { data: delData, error: delErr } = await supabase.storage.from(BUCKET).remove(toDelete);
    if (delErr) {
      console.error('Delete error:', delErr);
      process.exit(3);
    }

    console.log('Deleted objects:', delData);
    process.exit(0);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
