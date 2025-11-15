'use client';

import { useEffect, useRef } from 'react';
import supabase from '@/supabase/client';

type RealtimeHandler = (payload: any) => void;
type RealtimeOptions = {
  events?: ('INSERT' | 'UPDATE' | 'DELETE' | '*')[];
  filter?: string; // raw Supabase filter string (e.g. "conversation_id=eq.<id>")
  // or column/value shorthand
  column?: string;
  value?: string | number;
};

// Hook that subscribes to Postgres changes on a table with optional filters
export function useSupabaseRealtime(table: string, handler: RealtimeHandler, opts?: RealtimeOptions) {
  const attempts = useRef(0);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const buildFilter = () => {
      if (!opts) return undefined;
      if (opts.filter) return opts.filter;
      if (opts.column && (opts.value !== undefined)) return `${opts.column}=eq.${opts.value}`;
      return undefined;
    };

    const subscribe = async () => {
      if (!mounted) return;
      const events = (opts?.events && opts.events.length > 0) ? opts!.events : ['INSERT','UPDATE','DELETE'];
      const filter = buildFilter();
      const channel = supabase.channel(`public:${table}`);

      events.forEach((ev) => {
        const payloadFilter: any = { event: ev === '*' ? '*' : ev, schema: 'public', table };
        if (filter) payloadFilter.filter = filter;
        channel.on('postgres_changes', payloadFilter, (payload: any) => {
          try { handler(payload); } catch (err) { console.error('Realtime handler error', err); }
        });
      });

      try {
        await channel.subscribe();
        channelRef.current = channel;
        attempts.current = 0;
      } catch (err) {
        console.error('Realtime subscribe failed', err);
        // exponential backoff retry
        attempts.current = Math.min((attempts.current || 0) + 1, 6);
        const delay = Math.pow(2, attempts.current) * 1000;
        setTimeout(() => { subscribe(); }, delay);
      }
    };

    subscribe();

    return () => {
      mounted = false;
      const ch = channelRef.current;
      if (ch) {
        try { ch.unsubscribe(); } catch (e) { try { supabase.removeChannel(ch); } catch (_) {} }
      }
    };
  }, [table, handler, opts?.filter, opts?.column, opts?.value, opts?.events]);
}
