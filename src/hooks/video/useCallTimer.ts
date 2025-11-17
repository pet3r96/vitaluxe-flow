import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';

export interface UseCallTimerReturn {
  duration: number; // seconds
  formattedDuration: string; // "MM:SS"
  start: () => void;
  stop: () => void;
  reset: () => void;
  isRunning: boolean;
}

export const useCallTimer = (): UseCallTimerReturn => {
  const [duration, setDuration] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format duration to MM:SS
  const formattedDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Start timer
  const start = useCallback(() => {
    if (isRunning) return;
    
    logger.info('Call timer started');
    setIsRunning(true);
    
    intervalRef.current = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);
  }, [isRunning]);

  // Stop timer
  const stop = useCallback(() => {
    if (!isRunning) return;
    
    logger.info('Call timer stopped', { duration });
    setIsRunning(false);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [isRunning]);

  // Reset timer
  const reset = useCallback(() => {
    logger.info('Call timer reset');
    stop();
    setDuration(0);
  }, [stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    duration,
    formattedDuration: formattedDuration(duration),
    start,
    stop,
    reset,
    isRunning,
  };
};
