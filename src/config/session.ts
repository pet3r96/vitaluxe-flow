/**
 * Session Configuration
 * 
 * System uses a hard session timeout with automatic refresh on user activity.
 * See AuthContext.tsx for implementation.
 * 
 * Hard timeout: 60 minutes from sign-in.
 * Activity refresh: Session extends automatically when user is active.
 * Users are logged out after inactivity and redirected to /auth with 2FA required on next login.
 */

export const SESSION_CONFIG = {
  // Hard session timeout (30 minutes)
  HARD_TIMEOUT_MINUTES: 30,
  
  // Activity refresh settings
  REFRESH_ON_ACTIVITY: true,
  REFRESH_THRESHOLD_MINUTES: 5,
  ACTIVITY_CHECK_INTERVAL_MS: 30000,
  ACTIVITY_EVENTS: ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const,
} as const;
