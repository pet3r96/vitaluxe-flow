/**
 * Session Configuration - DEPRECATED
 * 
 * Idle timeout logic has been removed.
 * System now uses a simple 30-minute hard session timeout.
 * See AuthContext.tsx for implementation.
 * 
 * Hard timeout: 30 minutes from sign-in, regardless of activity.
 * Users are logged out and redirected to /auth with 2FA required on next login.
 */

export const SESSION_CONFIG = {
  // DEPRECATED - No longer used for idle tracking
  IDLE_TIMEOUT_MINUTES: 30,
  WARNING_BEFORE_LOGOUT_MINUTES: 2,
  ACTIVITY_UPDATE_INTERVAL_MS: 30000,
  SESSION_CHECK_INTERVAL_MS: 60000,
  ACTIVITY_EVENTS: ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const,
  
  // NEW: Hard session timeout (implemented in AuthContext.tsx)
  HARD_TIMEOUT_MINUTES: 30,
} as const;
