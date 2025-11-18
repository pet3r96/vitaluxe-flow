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

/**
 * Aggregate performance data for analysis
 */
export const getPerformanceReport = () => {
  const metrics = getPerformanceSummary();
  const entries = Object.entries(metrics) as [string, number][];
  
  if (entries.length === 0) {
    return {
      totalMeasurements: 0,
      averageLoadTime: 0,
      slowestPage: null,
      fastestPage: null,
      allMetrics: {}
    };
  }
  
  const loadTimes = entries.map(([_, time]) => time);
  const avg = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  
  return {
    totalMeasurements: entries.length,
    averageLoadTime: Math.round(avg),
    slowestPage: sorted[0] ? { name: sorted[0][0], time: Math.round(sorted[0][1]) } : null,
    fastestPage: sorted[sorted.length - 1] ? { name: sorted[sorted.length - 1][0], time: Math.round(sorted[sorted.length - 1][1]) } : null,
    allMetrics: Object.fromEntries(entries.map(([name, time]) => [name, Math.round(time)]))
  };
};
