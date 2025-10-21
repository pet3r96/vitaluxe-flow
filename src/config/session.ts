/**
 * Session Management Configuration
 * 
 * Centralized configuration for idle timeout and activity tracking.
 * These settings ensure HIPAA compliance by automatically logging out
 * inactive users to prevent unauthorized access to PHI.
 */

export const SESSION_CONFIG = {
  // Auto-logout after 30 minutes of complete inactivity
  IDLE_TIMEOUT_MINUTES: 30,
  
  // Show warning 2 minutes before logout
  WARNING_BEFORE_LOGOUT_MINUTES: 2,
  
  // How often to update last_activity in database (debounced)
  ACTIVITY_UPDATE_INTERVAL_MS: 30000, // 30 seconds
  
  // How often to check if user has been idle too long
  SESSION_CHECK_INTERVAL_MS: 60000, // 60 seconds
  
  // User interactions that count as "activity"
  ACTIVITY_EVENTS: ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const,
} as const;
