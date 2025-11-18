/**
 * Performance monitoring utilities for tracking page load times and interaction speeds
 * Target: < 200ms for interactions, < 1.5s for page loads
 */

export const measurePageLoad = (pageName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      console.log(`[Performance] ${pageName} loaded in ${duration.toFixed(2)}ms`);
      
      // Track metrics globally
      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.__perf = window.__perf || {};
        // @ts-ignore
        window.__perf[pageName] = duration;
      }
      
      return duration;
    }
  };
};

export const measureInteraction = (actionName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      
      if (duration > 200) {
        console.warn(`[Performance] Slow interaction: ${actionName} took ${duration.toFixed(2)}ms (target: < 200ms)`);
      } else {
        console.log(`[Performance] ${actionName} completed in ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    }
  };
};

/**
 * Get performance summary from window.__perf
 */
export const getPerformanceSummary = () => {
  if (typeof window === 'undefined') return {};
  // @ts-ignore
  return window.__perf || {};
};

/**
 * Clear performance metrics
 */
export const clearPerformanceMetrics = () => {
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.__perf = {};
  }
};
