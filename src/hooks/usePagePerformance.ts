import { useEffect, useRef } from 'react';
import { measurePageLoad } from '@/lib/performanceMonitor';
import { trackWebVitals } from '@/lib/webVitals';

/**
 * Reusable hook for page performance monitoring
 * Usage: usePagePerformance('PageName');
 */
export const usePagePerformance = (pageName: string, userRole?: string) => {
  const perfRef = useRef<{ end: () => number } | null>(null);
  
  // Initialize performance monitoring only once
  if (!perfRef.current) {
    perfRef.current = measurePageLoad(pageName);
    trackWebVitals(pageName, userRole);
  }

  useEffect(() => {
    return () => {
      perfRef.current?.end();
    };
  }, []);

  return perfRef.current;
};
