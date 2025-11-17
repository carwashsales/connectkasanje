import { NextResponse } from 'next/server';
import supabaseServer from '@/supabase/server-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('create-post: Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in server env');
}

export async function POST(req: Request) {
  // Guard: verify server env is present
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured: missing Supabase service key or URL' }, { status: 500 });
  }
  async function parseJsonBody(r: Request) {
    try {
      // Preferred: the standard Request.json() method
      if (typeof (r as any).json === 'function') {
        return await (r as any).json();
      }

      // Some runtimes expose a body with a json() helper
      if ((r as any).body && typeof (r as any).body.json === 'function') {
        return await (r as any).body.json();
      }

      // Fallback: read as text and JSON.parse
      const txt = await r.text();
      return txt ? JSON.parse(txt) : {};
    } catch (e) {
      console.error('create-post: body parse error', e);
      throw new Error('Invalid JSON body');
    }
  }

  try {
    const payload = await parseJsonBody(req);
    const { user_id, body, media = null, metadata = {}, visibility = 'public' } = payload;
    if (!user_id || !body) return NextResponse.json({ error: 'user_id and body required' }, { status: 400 });

    // Verify Authorization header contains a valid access token and that it
    // belongs to the same user_id being used in the payload.
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const { data: userData, error: getUserErr } = await supabaseServer.auth.getUser(token as string);
    if (getUserErr || !userData?.user) {
      console.error('create-post: token verification failed', getUserErr);
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }
    const actorId = (userData.user as any).id;
    if (actorId !== user_id) {
      return NextResponse.json({ error: 'Token does not match user_id', detail: { actorId, user_id } }, { status: 403 });
    }

    const { data, error } = await supabaseServer.from('posts').insert([{ user_id, body, media, metadata, visibility }]);
    if (error) {
      console.error('create-post error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ data }, { status: 200 });
  } catch (err: any) {
    console.error('create-post exception', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
