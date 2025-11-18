import { NextResponse } from 'next/server';
import supabaseServer from '@/supabase/server-client';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('create-conversation: Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_URL in server env');
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured: missing Supabase service key or URL' }, { status: 500 });
  }

  async function parseJsonBody(r: Request) {
    try {
      if (typeof (r as any).json === 'function') return await (r as any).json();
      if ((r as any).body && typeof (r as any).body.json === 'function') return await (r as any).body.json();
      const txt = await r.text();
      return txt ? JSON.parse(txt) : {};
    } catch (e) {
      console.error('create-conversation: body parse error', e);
      throw new Error('Invalid JSON body');
    }
  }

  try {
    const payload = await parseJsonBody(req);
    const { user_id, target_user_id } = payload as { user_id?: string; target_user_id?: string };
    if (!user_id || !target_user_id) return NextResponse.json({ error: 'user_id and target_user_id required' }, { status: 400 });
    if (user_id === target_user_id) return NextResponse.json({ error: 'Cannot create conversation with self' }, { status: 400 });

    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing Authorization Bearer token' }, { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');

    const { data: userData, error: getUserErr } = await supabaseServer.auth.getUser(token as string);
    if (getUserErr || !userData?.user) {
      console.error('create-conversation: token verification failed', getUserErr);
      return NextResponse.json({ error: 'Invalid access token' }, { status: 401 });
    }
    const actorId = (userData.user as any).id;
    if (actorId !== user_id) {
      return NextResponse.json({ error: 'Token does not match user_id', detail: { actorId, user_id } }, { status: 403 });
    }

    // 1) Try to find an existing conversation by looking at messages between the two users.
    const { data: existingMessages, error: msgError } = await supabaseServer
      .from('messages')
      .select('conversation_id')
      .or(`and(sender_id.eq.${user_id},recipient_id.eq.${target_user_id}),and(sender_id.eq.${target_user_id},recipient_id.eq.${user_id})`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (msgError) {
      console.error('create-conversation: error querying messages', msgError);
      return NextResponse.json({ error: 'Failed to query messages' }, { status: 500 });
    }

    if (existingMessages && existingMessages.length > 0 && existingMessages[0].conversation_id) {
      return NextResponse.json({ conversationId: existingMessages[0].conversation_id }, { status: 200 });
    }

    // 2) No existing conversation found — create one using the service role client.
    const now = new Date().toISOString();
    const { data: convData, error: convError } = await supabaseServer
      .from('conversations')
      .insert([{ last_message_text: '', last_message_at: now }])
      .select()
      .single();

    if (convError) {
      console.error('create-conversation: insert error', convError);
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }

    // 3) Insert an initial message so the conversation is discoverable by
    // flows that read conversations by scanning the `messages` table.
    try {
      const initialText = '';
      const { data: msgData, error: msgInsertErr } = await supabaseServer
        .from('messages')
        .insert([{ conversation_id: convData.id, sender_id: user_id, recipient_id: target_user_id, text: initialText, created_at: now }])
        .select()
        .single();

      if (msgInsertErr) {
        // If message insert fails, log but still return the conversation id —
        // the conversation exists and can be repaired later. We return 201.
        console.error('create-conversation: failed to insert initial message', msgInsertErr);
      } else {
        // Update conversation's last message fields to reflect the initial message.
        const { error: updateErr } = await supabaseServer
          .from('conversations')
          .update({ last_message_text: initialText, last_message_at: now })
          .eq('id', convData.id);
        if (updateErr) console.error('create-conversation: failed to update conversation last_message fields', updateErr);
      }
    } catch (e) {
      console.error('create-conversation: error creating initial message', e);
    }

    return NextResponse.json({ conversationId: convData.id }, { status: 201 });
  } catch (err: any) {
    console.error('create-conversation exception', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
