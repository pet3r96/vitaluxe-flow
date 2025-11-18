import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

/**
 * Session Validator Middleware - DEPRECATED
 * 
 * This module is no longer used. The system now uses a simple 60-minute hard
 * session timeout on the client side with no server-side validation.
 * 
 * Previous behavior: Validated sessions based on 30-minute idle timeout
 * New behavior: Client-side hard timeout (60 minutes from sign-in)
 * 
 * This file is kept for reference only and is not imported anywhere.
 */

export interface SessionValidationResult {
  valid: boolean;
  reason?: 'no_session' | 'idle_timeout' | 'session_not_found';
  idleMinutes?: number;
}

/**
 * DEPRECATED - No longer used
 */
export async function validateSessionFreshness(
  supabase: any,
  userId: string
): Promise<SessionValidationResult> {
  // Always return valid - client handles timeout
  return {
    valid: true,
  };
}
