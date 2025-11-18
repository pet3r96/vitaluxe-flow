/**
 * Web Vitals tracking with automatic database logging
 * Tracks Core Web Vitals: CLS, INP, LCP, FCP, TTFB
 */
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from 'web-vitals';
import { supabase } from '@/integrations/supabase/client';
import { logger } from './logger';

/**
 * Send web vital metric to database
 */
const sendToDatabase = async (metric: Metric, pageName: string, userRole?: string) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('performance_metrics').insert({
      page_name: pageName,
      user_id: user?.id || null,
      user_role: userRole || null,
      load_time_ms: metric.value,
      metric_type: metric.name,
      metric_value: metric.value,
      user_agent: navigator.userAgent,
      viewport_width: window.innerWidth,
      viewport_height: window.innerHeight,
      connection_type: (navigator as any).connection?.effectiveType || 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience
    logger.error('Failed to log web vital', { metric: metric.name, error });
  }
};

/**
 * Initialize web vitals tracking for a specific page
 */
export const trackWebVitals = (pageName: string, userRole?: string) => {
  // Track Cumulative Layout Shift
  onCLS((metric) => {
    logger.info(`[Web Vital] CLS for ${pageName}`, { value: metric.value.toFixed(3) });
    sendToDatabase(metric, pageName, userRole);
  });

  // Track Interaction to Next Paint
  onINP((metric) => {
    logger.info(`[Web Vital] INP for ${pageName}`, { value: metric.value.toFixed(0) + 'ms' });
    sendToDatabase(metric, pageName, userRole);
  });

  // Track Largest Contentful Paint
  onLCP((metric) => {
    logger.info(`[Web Vital] LCP for ${pageName}`, { value: metric.value.toFixed(0) + 'ms' });
    sendToDatabase(metric, pageName, userRole);
  });

  // Track First Contentful Paint
  onFCP((metric) => {
    logger.info(`[Web Vital] FCP for ${pageName}`, { value: metric.value.toFixed(0) + 'ms' });
    sendToDatabase(metric, pageName, userRole);
  });

  // Track Time to First Byte
  onTTFB((metric) => {
    logger.info(`[Web Vital] TTFB for ${pageName}`, { value: metric.value.toFixed(0) + 'ms' });
    sendToDatabase(metric, pageName, userRole);
  });
};

/**
 * Get web vitals performance targets
 */
export const getWebVitalsTargets = () => ({
  CLS: { good: 0.1, needsImprovement: 0.25, poor: 0.25 },
  INP: { good: 200, needsImprovement: 500, poor: 500 },
  LCP: { good: 2500, needsImprovement: 4000, poor: 4000 },
  FCP: { good: 1800, needsImprovement: 3000, poor: 3000 },
  TTFB: { good: 800, needsImprovement: 1800, poor: 1800 },
});
