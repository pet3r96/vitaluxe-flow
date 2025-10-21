import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

/**
 * Session Validator Middleware
 * 
 * Validates that user sessions are fresh (not idle >30 minutes).
 * Can be used by edge functions to enforce idle timeout server-side.
 */

export interface SessionValidationResult {
  valid: boolean;
  reason?: 'no_session' | 'idle_timeout' | 'session_not_found';
  idleMinutes?: number;
}

/**
 * Validate that a user's session is still fresh
 * @param supabase - Supabase client
 * @param userId - User ID to validate
 * @returns Validation result with details
 */
export async function validateSessionFreshness(
  supabase: any,
  userId: string
): Promise<SessionValidationResult> {
  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .select('last_activity')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('Session validation error:', error);
      return {
        valid: false,
        reason: 'session_not_found',
      };
    }

    const lastActivity = new Date(data.last_activity).getTime();
    const idleMinutes = (Date.now() - lastActivity) / 60000;

    if (idleMinutes > 30) {
      // Session is stale - delete it
      await supabase
        .from('active_sessions')
        .delete()
        .eq('user_id', userId);

      // Log the forced logout
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action_type: 'force_logout',
        entity_type: 'active_sessions',
        details: {
          reason: 'idle_timeout',
          idle_minutes: idleMinutes,
          last_activity: data.last_activity,
        },
      });

      return {
        valid: false,
        reason: 'idle_timeout',
        idleMinutes: Math.floor(idleMinutes),
      };
    }

    // Session is valid - optionally update last_activity
    // (Note: We don't update here to avoid race conditions with client updates)

    return {
      valid: true,
    };
  } catch (error) {
    console.error('Session validation failed:', error);
    return {
      valid: false,
      reason: 'no_session',
    };
  }
}
