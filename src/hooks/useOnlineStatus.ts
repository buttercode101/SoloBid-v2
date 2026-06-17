import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getPendingSync, removePendingSync } from '../lib/offline';

async function processPendingQueue() {
  try {
    const pending = await getPendingSync();
    for (const item of pending) {
      if (item.type === 'quote-upsert') {
        const { error } = await supabase.from('quotes').upsert(item.payload);
        if (!error) {
          await removePendingSync(item.id);
        }
      }
    }
  } catch (err) {
    console.error('Failed to process pending sync queue:', err);
  }
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processPendingQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
