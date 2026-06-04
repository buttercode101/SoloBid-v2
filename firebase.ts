import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

export function useRateLimit(delayMs: number = 1000) {
  const [isLimited, setIsLimited] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (isLimited) {
      toast.error('Please wait before trying again');
      return;
    }

    setIsLimited(true);
    timeoutRef.current = setTimeout(() => setIsLimited(false), delayMs);
    
    return await fn();
  }, [isLimited, delayMs]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { isLimited, execute };
}
