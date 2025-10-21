import { supabase } from "@/integrations/supabase/client";

/**
 * CSRF Protection Utilities
 * Implements Cross-Site Request Forgery protection for sensitive operations
 */

/**
 * Generates a new CSRF token and stores it both in sessionStorage and database
 * Call this when initializing a user session
 */
export const generateCSRFToken = async (): Promise<string | null> => {
  try {
    const token = crypto.randomUUID();
    sessionStorage.setItem('csrf_token', token);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      import('@/lib/logger').then(({ logger }) => {
        logger.warn('Cannot generate CSRF token: No authenticated user');
      });
      return null;
    }
    
    // Store in database for server-side validation
    // Note: Types will be available after database migration is applied
    try {
      const { error } = await supabase.from('user_sessions' as any).upsert({
        user_id: user.id,
        csrf_token: token,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      
      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('Failed to store CSRF token', error);
        });
        return null;
      }
    } catch (err) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error storing CSRF token', err);
      });
      return null;
    }
    
    return token;
  } catch (error) {
    import('@/lib/logger').then(({ logger }) => {
      logger.error('Error generating CSRF token', error);
    });
    return null;
  }
};

/**
 * Validates a CSRF token against both sessionStorage and database
 * Call this before performing sensitive operations (orders, payments, profile updates)
 */
export const validateCSRFToken = async (token: string): Promise<boolean> => {
  try {
    const storedToken = sessionStorage.getItem('csrf_token');
    
    if (token !== storedToken) {
      import('@/lib/logger').then(({ logger }) => {
        logger.warn('CSRF token mismatch with session storage');
      });
      return false;
    }
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      import('@/lib/logger').then(({ logger }) => {
        logger.warn('Cannot validate CSRF token: No authenticated user');
      });
      return false;
    }
    
    // Verify in database
    // Note: Types will be available after database migration is applied
    try {
      const { data, error } = await supabase
        .from('user_sessions' as any)
        .select('csrf_token')
        .eq('user_id', user.id)
        .eq('csrf_token', token)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (error || !data) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error('CSRF token validation failed', error);
        });
        return false;
      }
      
      return true;
    } catch (err) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Error validating CSRF token', err);
      });
      return false;
    }
  } catch (error) {
    import('@/lib/logger').then(({ logger }) => {
      logger.error('Error validating CSRF token', error);
    });
    return false;
  }
};

/**
 * Gets the current CSRF token from sessionStorage
 * Use this to include token in requests that require CSRF protection
 */
export const getCSRFToken = (): string | null => {
  return sessionStorage.getItem('csrf_token');
};

/**
 * Gets the current user's CSRF token from the database
 * This is used when calling edge functions that require CSRF protection
 */
export const getCurrentCSRFToken = async (): Promise<string | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      import('@/lib/logger').then(({ logger }) => {
        logger.warn('Cannot get CSRF token: No authenticated user');
      });
      return null;
    }
    
    const { data, error } = await supabase
      .from('user_sessions' as any)
      .select('csrf_token')
      .eq('user_id', user.id)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Failed to fetch CSRF token', error);
      });
      return null;
    }
    
    return (data as any).csrf_token || null;
  } catch (error) {
    import('@/lib/logger').then(({ logger }) => {
      logger.error('Error fetching CSRF token', error);
    });
    return null;
  }
};

/**
 * Clears the CSRF token from sessionStorage
 * Call this on logout or session expiration
 */
export const clearCSRFToken = () => {
  sessionStorage.removeItem('csrf_token');
};
