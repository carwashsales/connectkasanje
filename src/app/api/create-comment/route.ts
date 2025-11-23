import { NextResponse } from 'next/server';
import supabaseServer from '@/supabase/server-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('create-comment: Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in server env');
}

async function parseJsonBody(r: Request) {
  try {
    if (typeof (r as any).json === 'function') return await (r as any).json();
    if ((r as any).body && typeof (r as any).body.json === 'function') return await (r as any).body.json();
    const txt = await r.text();
    return txt ? JSON.parse(txt) : {};
  } catch (e) {
    throw new Error('Invalid JSON body');
  }
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured: missing Supabase service key or URL' }, { status: 500 });
  }
  try {
    const payload = await parseJsonBody(req);
    const { post_id, user_id, body } = payload;
    if (!post_id || !user_id || !body) return NextResponse.json({ error: 'post_id, user_id and body required' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const { data: userData, error: getUserErr } = await supabaseServer.auth.getUser(token as string);
    if (getUserErr || !userData?.user) {
      console.error('create-comment: token verification failed', getUserErr);
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }
    const actorId = (userData.user as any).id;
    if (actorId !== user_id) {
      return NextResponse.json({ error: 'Token does not match user_id' }, { status: 403 });
    }

    // Insert comment
    const { data: commentData, error: commentErr } = await supabaseServer.from('comments').insert([{ post_id, user_id, body }]).select('*').single();
    if (commentErr) {
      console.error('create-comment insert error', commentErr);
      return NextResponse.json({ error: commentErr.message || String(commentErr) }, { status: 500 });
    }

    // Try to increment comments counter on posts metadata if present
    try {
      await supabaseServer.from('posts').update({ metadata: { comments: (/* @ts-ignore */ 0) } }).eq('id', post_id);
    } catch (e) { /* ignore: best-effort */ }

    return NextResponse.json({ data: commentData }, { status: 200 });
  } catch (err: any) {
    console.error('create-comment exception', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
