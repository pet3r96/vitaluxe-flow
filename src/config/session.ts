/**
 * Session Configuration
 * 
 * System uses a hard session timeout with automatic refresh on user activity.
 * See AuthContext.tsx for implementation.
 * 
 * Hard timeout: 60 minutes from sign-in (or last activity).
 * Inactivity timeout: 30 minutes of no activity = forced logout.
 * Activity refresh: Session extends to 60 minutes on user activity.
 * Maximum session: 2 hours total (regardless of activity).
 * Users are logged out after inactivity and redirected to /auth with 2FA required on next login.
 */

export const SESSION_CONFIG = {
  // Hard session timeout (60 minutes)
  HARD_TIMEOUT_MINUTES: 60,
  
  // Activity refresh settings
  REFRESH_ON_ACTIVITY: true,
  REFRESH_THRESHOLD_MINUTES: 2, // Aggressive threshold for faster timeout detection
  ACTIVITY_CHECK_INTERVAL_MS: 10000, // Check every 10 seconds
  ACTIVITY_EVENTS: ['mousedown', 'keydown', 'scroll', 'touchstart'] as const, // Intentional actions only
  
  // Maximum session duration (2 hours) regardless of activity
  MAX_SESSION_MINUTES: 120,
  
  // Hard inactivity timeout (30 minutes with NO activity = force logout)
  INACTIVITY_TIMEOUT_MINUTES: 30,
} as const;
