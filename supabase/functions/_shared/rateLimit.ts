/**
 * Minimal, dependency-free rate limiting helper
 * Uses function_rate_limits table to track calls per user
 */

type SupabaseClient = {
  from: (table: string) => any;
};

interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
}

/**
 * Check if a user has exceeded their rate limit for a function
 * @param supabase - Supabase client instance
 * @param fnName - Name of the function being rate limited
 * @param userId - User ID to check
 * @param windowSeconds - Time window in seconds
 * @param maxCalls - Maximum calls allowed in the window
 * @returns Object with allowed status and optional retryAfter time
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  fnName: string,
  userId: string,
  windowSeconds: number,
  maxCalls: number
): Promise<RateLimitResult> {
  const windowStartIso = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // Count recent calls within the time window
  const { count, error } = await supabase
    .from('function_rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('function_name', fnName)
    .eq('user_id', userId)
    .gte('created_at', windowStartIso);

  // Fail-open to avoid hard lockouts on DB errors
  if (error) {
    const { edgeLogger } = await import('./logger.ts');
    edgeLogger.error('Rate limit check error (failing open)', error);
    return { allowed: true };
  }

  // Check if limit exceeded
  if ((count ?? 0) >= maxCalls) {
    return { 
      allowed: false, 
      retryAfter: windowSeconds 
    };
  }

  // Record this call
  const { error: insertError } = await supabase
    .from('function_rate_limits')
    .insert({
      function_name: fnName,
      user_id: userId
    });

  if (insertError) {
    const { edgeLogger } = await import('./logger.ts');
    edgeLogger.error('Rate limit insert error (failing open)', insertError);
  }

  return { allowed: true };
}

/**
 * Example usage in edge functions:
 * 
 * import { checkRateLimit } from '../_shared/rateLimit.ts';
 * 
 * const rl = await checkRateLimit(supabaseClient, 'place-order', user.id, 60, 5);
 * if (!rl.allowed) {
 *   return new Response(JSON.stringify({
 *     success: false,
 *     error: { 
 *       code: 'RATE_LIMIT_EXCEEDED', 
 *       message: 'Too many requests', 
 *       retryAfter: rl.retryAfter 
 *     }
 *   }), { 
 *     status: 429, 
 *     headers: { 
 *       'Content-Type': 'application/json',
 *       'Retry-After': String(rl.retryAfter)
 *     }
 *   });
 * }
 */
