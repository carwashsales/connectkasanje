"use client";

import supabase from '@/supabase/client';

type StartPresenceOpts = {
  heartbeatMs?: number;
};

// Starts a simple presence heartbeat for the given user id.
// Returns a stop function that will clear the heartbeat and mark the user offline.
export async function startPresence(userId: string, opts?: StartPresenceOpts) {
  const heartbeatMs = opts?.heartbeatMs ?? 30_000;

  const upsert = async () => {
    try {
      await supabase.from('presence').upsert({ user_id: userId, online: true, last_seen: new Date().toISOString() });
    } catch (err) {
      console.error('presence upsert failed', err);
    }
  };

  // initial upsert
  await upsert();

  const id = setInterval(upsert, heartbeatMs) as unknown as number;

  // stop function: clear interval and mark offline
  return async function stopPresence() {
    try {
      clearInterval(id as any);
      await supabase.from('presence').update({ online: false, last_seen: new Date().toISOString() }).eq('user_id', userId);
    } catch (err) {
      console.error('stopping presence failed', err);
    }
  };
}

// Fetch presence rows for a set of user ids
export async function fetchPresence(userIds: string[]) {
  if (!userIds || userIds.length === 0) return [];
  try {
    const { data, error } = await supabase.from('presence').select('*').in('user_id', userIds).order('last_seen', { ascending: false });
    if (error) {
      console.error('fetchPresence error', error);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.error('fetchPresence failed', err);
    return [];
  }
}

export default { startPresence, fetchPresence };

