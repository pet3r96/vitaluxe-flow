/**
 * DEPRECATED - Session Manager Utilities
 * 
 * These utilities are no longer used. The idle timeout model has been removed
 * in favor of a simple 60-minute hard session timeout managed in AuthContext.tsx.
 * 
 * The new system:
 * - Sets a 60-minute timer when user signs in
 * - Stores expiration timestamp in localStorage
 * - Automatically logs out after exactly 60 minutes
 * - No idle tracking, no activity monitoring, no database writes
 * - Hard refresh safe (timer is recalculated from localStorage)
 * 
 * This file is kept for reference only.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

let lastUpdateTime = 0;
const UPDATE_THROTTLE_MS = 30000;

export const updateActivity = async (): Promise<void> => {
  // DEPRECATED - No-op
  return;
};

export const isSessionExpired = async (): Promise<boolean> => {
  // DEPRECATED - No longer used
  return false;
};

export const getIdleMinutes = async (): Promise<number | null> => {
  // DEPRECATED - No longer used
  return null;
};
