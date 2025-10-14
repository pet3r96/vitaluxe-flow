/**
 * Rate Limiting Middleware for Edge Functions
 * 
 * Implements IP-based rate limiting to prevent:
 * - DoS attacks
 * - Brute force attempts
 * - API abuse
 * - Resource exhaustion
 * 
 * Usage in edge functions:
 * 
 * import { RateLimiter } from "../_shared/rateLimiter.ts";
 * 
 * const limiter = new RateLimiter();
 * const ipAddress = req.headers.get('x-forwarded-for') || 'unknown';
 * 
 * const { allowed, remaining } = await limiter.checkLimit(
 *   supabaseClient,
 *   ipAddress,
 *   'auth/sign-in',
 *   { maxRequests: 5, windowSeconds: 900 } // 5 requests per 15 minutes
 * );
 * 
 * if (!allowed) {
 *   return new Response(
 *     JSON.stringify({ error: 'Rate limit exceeded' }), 
 *     { status: 429 }
 *   );
 * }
 */

export interface RateLimitConfig {
  maxRequests: number;    // Maximum requests allowed in the time window
  windowSeconds: number;  // Time window in seconds
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  /**
   * Check if a request from a specific IP is within rate limits
   * 
   * @param supabase - Supabase client for logging violations
   * @param ip - IP address of the requester
   * @param endpoint - Endpoint being accessed (e.g., 'auth/sign-in')
   * @param config - Rate limit configuration
   * @returns { allowed: boolean, remaining: number }
   */
  async checkLimit(
    supabase: any,
    ip: string,
    endpoint: string,
    config: RateLimitConfig
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `${ip}:${endpoint}`;
    const now = Date.now();
    const windowStart = now - config.windowSeconds * 1000;

    // Get existing requests for this key
    let timestamps = this.requests.get(key) || [];
    
    // Filter out old requests outside the time window
    timestamps = timestamps.filter(t => t > windowStart);
    
    // Check if limit is exceeded
    if (timestamps.length >= config.maxRequests) {
      console.warn(`⚠️ Rate limit exceeded for ${ip} on ${endpoint}`);
      
      // Log rate limit violation to security_events
      try {
        await supabase.from('security_events').insert({
          event_type: 'rate_limit_exceeded',
          severity: 'medium',
          ip_address: ip,
          details: {
            endpoint,
            request_count: timestamps.length,
            window_seconds: config.windowSeconds,
            max_requests: config.maxRequests,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error('Failed to log rate limit violation:', error);
      }

      return { allowed: false, remaining: 0 };
    }

    // Add new request timestamp
    timestamps.push(now);
    this.requests.set(key, timestamps);

    const remaining = config.maxRequests - timestamps.length;
    return { allowed: true, remaining };
  }

  /**
   * Clean up old entries from the rate limiter cache
   * Call this periodically to prevent memory leaks
   */
  cleanup(maxAgeSeconds: number = 3600) {
    const now = Date.now();
    const cutoff = now - maxAgeSeconds * 1000;

    for (const [key, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter(t => t > cutoff);
      
      if (validTimestamps.length === 0) {
        // No recent requests, remove the key
        this.requests.delete(key);
      } else {
        // Update with only recent timestamps
        this.requests.set(key, validTimestamps);
      }
    }
  }
}

/**
 * Predefined rate limit configurations for common endpoints
 */
export const RATE_LIMITS = {
  // Authentication endpoints (stricter limits)
  AUTH_SIGN_IN: { maxRequests: 5, windowSeconds: 900 },      // 5 per 15 min
  AUTH_SIGN_UP: { maxRequests: 3, windowSeconds: 3600 },     // 3 per hour
  PASSWORD_RESET: { maxRequests: 3, windowSeconds: 3600 },   // 3 per hour
  
  // API endpoints (moderate limits)
  API_READ: { maxRequests: 100, windowSeconds: 60 },         // 100 per minute
  API_WRITE: { maxRequests: 30, windowSeconds: 60 },         // 30 per minute
  
  // Admin operations (higher limits)
  ADMIN_OPERATIONS: { maxRequests: 200, windowSeconds: 60 }, // 200 per minute
  
  // File uploads (very strict)
  FILE_UPLOAD: { maxRequests: 10, windowSeconds: 3600 },     // 10 per hour
};

/**
 * Helper function to get client IP from request headers
 */
export function getClientIP(req: Request): string {
  // Check common headers for forwarded IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to unknown if no IP headers found
  return 'unknown';
}
