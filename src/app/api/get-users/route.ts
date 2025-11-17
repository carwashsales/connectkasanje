import { NextResponse } from 'next/server';
import supabaseServer from '@/supabase/server-client';

export async function GET() {
  // Validate server environment first for clearer errors in production
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('get-users: Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in server env');
    return NextResponse.json({ error: 'Server not configured: missing Supabase service key or URL' }, { status: 500 });
  }

  try {
    const { data, error } = await supabaseServer.from('profiles').select('id, username, full_name, avatar_url, bio, metadata').order('full_name', { ascending: true }).limit(100);
    if (error) {
      console.error('get-users error', error);
      return NextResponse.json({ error: error.message || 'db error' }, { status: 500 });
    }
    const users = (data || []).map((row: any) => ({
      id: row.id,
      uid: row.id,
      name: row.full_name ?? row.username ?? '',
      email: row.metadata?.email,
      avatar: { url: row.avatar_url ?? '', hint: '' },
      bio: row.bio ?? ''
    }));
    return NextResponse.json({ users });
  } catch (err) {
    console.error('get-users unexpected', err);
    return NextResponse.json({ error: 'unexpected' }, { status: 500 });
  }
}
