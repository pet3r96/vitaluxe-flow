import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Session Management Utilities
 * 
 * IMPORTANT: These utilities are for reference only.
 * 
 * DO NOT call isSessionExpired() or getIdleMinutes() directly from components.
 * All session timeout enforcement is centralized in AuthContext.tsx.
 * 
 * The AuthContext:
 * - Monitors idle time via active_sessions table
 * - Enforces 30-minute timeout with 2-minute warning
 * - Applies to ALL users including admins
 * - Handles logout and redirect automatically
 * 
 * These functions exist for edge cases and testing only.
 */

let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 30000; // Only update database every 30 seconds

/**
 * Update the last_activity timestamp for the current session
 * Throttled to prevent excessive database writes
 */
export const updateActivity = async (): Promise<void> => {
  const now = Date.now();
  
  // Throttle updates to max once per 30 seconds
  if (now - lastUpdateTime < UPDATE_THROTTLE_MS) {
    return;
  }
  
  lastUpdateTime = now;
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return;
    }
    
    // Update last_activity in active_sessions table
    const { error } = await supabase
      .from('active_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('user_id', session.user.id);
    
    if (error) {
      logger.error('Failed to update session activity', error);
    }
  } catch (error) {
    logger.error('Error updating activity', error);
  }
};

/**
 * Check if the current session has expired due to inactivity
 * @returns true if session is expired (>30 minutes idle)
 */
export const isSessionExpired = async (): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return true;
    }
    
    const { data, error } = await supabase
      .from('active_sessions')
      .select('last_activity')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (error || !data) {
      logger.error('Failed to check session expiry', error);
      return false; // Fail open - don't force logout on errors
    }
    
    const lastActivity = new Date(data.last_activity).getTime();
    const idleMinutes = (Date.now() - lastActivity) / 60000;
    
    return idleMinutes > 30;
  } catch (error) {
    logger.error('Error checking session expiry', error);
    return false;
  }
};

/**
 * Get the number of minutes the user has been idle
 * @returns idle time in minutes, or null if cannot determine
 */
export const getIdleMinutes = async (): Promise<number | null> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return null;
    }
    
    const { data, error } = await supabase
      .from('active_sessions')
      .select('last_activity')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    if (error || !data) {
      return null;
    }
    
    const lastActivity = new Date(data.last_activity).getTime();
    return (Date.now() - lastActivity) / 60000;
  } catch (error) {
    logger.error('Error getting idle minutes', error);
    return null;
  }
};
