import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // Fail fast in server logs if env not configured
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
}

const supabaseAdmin = createClient(SUPABASE_URL || '', SERVICE_ROLE_KEY || '');

export async function POST(req: Request) {
  async function parseJsonBody(r: Request) {
    try {
      if (typeof (r as any).json === 'function') {
        return await (r as any).json();
      }
      if ((r as any).body && typeof (r as any).body.json === 'function') {
        return await (r as any).body.json();
      }
      const txt = await r.text();
      return txt ? JSON.parse(txt) : {};
    } catch (e) {
      console.error('create-profile: body parse error', e);
      throw new Error('Invalid JSON body');
    }
  }

  try {
    const body = await parseJsonBody(req);
    const { user_id, email, full_name } = body;
    if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 });

    const username = (email && typeof email === 'string') ? email.split('@')[0] : `user-${String(user_id).slice(0,6)}`;

    const { data, error } = await supabaseAdmin.from('profiles').upsert([
      { id: user_id, username, full_name: full_name ?? null, avatar_url: null, metadata: { email } }
    ]);

    if (error) {
      console.error('create-profile error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error('create-profile exception', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
