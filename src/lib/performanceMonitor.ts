/**
 * Performance monitoring utilities for tracking page load times and interaction speeds
 * Target: < 200ms for interactions, < 400ms for page loads (desktop), < 700ms (mobile)
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

/**
 * Send performance metric to database
 */
const sendToDatabase = async (pageName: string, duration: number, metricType: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Get user role if available
    let userRole = null;
    if (user?.id) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      userRole = roleData?.role || null;
    }
    
    await supabase.from('performance_metrics').insert({
      page_name: pageName,
      user_id: user?.id || null,
      user_role: userRole,
      load_time_ms: duration,
      metric_type: metricType,
      metric_value: duration,
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      connection_type: (navigator as any).connection?.effectiveType || 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience
    logger.error('Failed to log performance metric', { pageName, error });
  }
};

export const measurePageLoad = (pageName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      
      // Determine if load time is acceptable
      const isSlow = duration > 400;
      const logMethod = isSlow ? console.warn : console.log;
      const icon = isSlow ? '🐌' : '⚡';
      
      logMethod(`${icon} [Performance] ${pageName} loaded in ${duration.toFixed(2)}ms`);
      
      // Track metrics globally
      if (typeof window !== 'undefined') {
        // @ts-ignore
        window.__perf = window.__perf || {};
        // @ts-ignore
        window.__perf[pageName] = duration;
      }
      
      // Send to database (async, non-blocking)
      sendToDatabase(pageName, duration, 'page_load');
      
      return duration;
    }
  };
};

export const measureInteraction = (actionName: string) => {
  const start = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - start;
      
      const isSlow = duration > 200;
      const logMethod = isSlow ? console.warn : console.log;
      const icon = isSlow ? '⚠️' : '✅';
      
      if (isSlow) {
        logMethod(`${icon} [Performance] Slow interaction: ${actionName} took ${duration.toFixed(2)}ms (target: < 200ms)`);
      } else {
        logMethod(`${icon} [Performance] ${actionName} completed in ${duration.toFixed(2)}ms`);
      }
      
      // Send to database (async, non-blocking)
      sendToDatabase(actionName, duration, 'interaction');
      
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
