import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('health: missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL');
    return NextResponse.json({ ok: false, reason: 'server-missing-env' }, { status: 500 });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    // do a lightweight select to confirm DB connectivity and that RLS isn't blocking server role
    const { data, error } = await supabaseAdmin.from('profiles').select('id').limit(1);
    if (error) {
      console.error('health: db select error', error.message || error);
      return NextResponse.json({ ok: false, reason: 'db-error', detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, rows: Array.isArray(data) ? data.length : 0 });
  } catch (err) {
    console.error('health: unexpected', err);
    return NextResponse.json({ ok: false, reason: 'unexpected', detail: String(err) }, { status: 500 });
  }
}
