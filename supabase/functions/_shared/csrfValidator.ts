import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * CSRF Token Validator
 * Validates CSRF tokens against the user_sessions table
 */
export async function validateCSRFToken(
  supabase: any,
  userId: string,
  token: string | undefined
): Promise<{ valid: boolean; error?: string }> {
  if (!token) {
    return { valid: false, error: 'CSRF token is required' };
  }

  try {
    const { data, error } = await supabase
      .from('user_sessions')
      .select('csrf_token')
      .eq('user_id', userId)
      .eq('csrf_token', token)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      const { edgeLogger } = await import('./logger.ts');
      edgeLogger.error('CSRF validation failed', error);
      return { valid: false, error: 'Invalid or expired CSRF token' };
    }

    return { valid: true };
  } catch (err) {
    const { edgeLogger } = await import('./logger.ts');
    edgeLogger.error('CSRF validation error', err);
    return { valid: false, error: 'CSRF validation failed' };
  }
}
