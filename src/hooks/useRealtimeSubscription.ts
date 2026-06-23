import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Options {
  table: string;
  userId: string;
  filter?: string;
  onUpdate: () => void;
}

/**
 * Subscribes to Postgres changes for a table filtered by user_id and calls
 * onUpdate on any INSERT / UPDATE / DELETE. Cleans up on unmount.
 */
export function useRealtimeSubscription({ table, userId, filter, onUpdate }: Options) {
  useEffect(() => {
    if (!userId) return;
    const channelFilter = filter ?? `user_id=eq.${userId}`;
    const channel = supabase
      .channel(`${table}-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: channelFilter },
        onUpdate,
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // onUpdate is intentionally excluded: callers should pass a stable ref (useCallback)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, userId, filter]);
}
