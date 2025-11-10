/**
 * Shared utility functions for BareMeds integration
 */

/**
 * Extracts site_id from BareMeds endpoint URL
 * Supports multiple URL patterns:
 * - /api/site/123/orders
 * - /api/orders?site_id=123
 * - /123/api/orders
 */
export function extractSiteIdFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    
    // Check query parameter
    const siteIdParam = parsed.searchParams.get('site_id');
    if (siteIdParam) {
      return siteIdParam;
    }
    
    // Check path segments
    const pathMatch = parsed.pathname.match(/\/site\/(\d+)|\/(\d+)\/api/);
    if (pathMatch) {
      return pathMatch[1] || pathMatch[2];
    }
    
    // Check last path segment if it's numeric
    const segments = parsed.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (/^\d+$/.test(lastSegment)) {
      return lastSegment;
    }
    
    return undefined;
  } catch (error) {
    console.error('[extractSiteIdFromUrl] Invalid URL:', url, error);
    return undefined;
  }
}

/**
 * Determines if an HTTP status code is retryable
 * - 5xx errors: Server issues, should retry
 * - 429: Rate limit, should retry with backoff
 * - 4xx (except 429): Client errors, don't retry
 * - 2xx/3xx: Success, no retry needed
 */
export function isRetryableStatusCode(statusCode: number): boolean {
  // Server errors are retryable
  if (statusCode >= 500 && statusCode < 600) {
    return true;
  }
  
  // Rate limit is retryable
  if (statusCode === 429) {
    return true;
  }
  
  // Client errors are NOT retryable (bad payload, auth, etc.)
  if (statusCode >= 400 && statusCode < 500) {
    return false;
  }
  
  // Success codes don't need retry
  return false;
}

/**
 * Calculates exponential backoff delay
 * @param attempt - Current retry attempt (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 30000)
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

/**
 * Sanitizes BareMeds response for logging (removes sensitive data)
 */
export function sanitizeBaremedsResponse(response: any): any {
  if (!response || typeof response !== 'object') {
    return response;
  }
  
  const sanitized = { ...response };
  
  // Remove sensitive fields
  const sensitiveFields = ['token', 'password', 'api_key', 'secret', 'ssn', 'credit_card'];
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}
