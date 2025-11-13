import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Impersonation Service
 * Handles admin impersonation of other users
 */

export interface ImpersonationSession {
  targetUserId: string;
  targetEmail: string;
  startedAt: string;
}

/**
 * Start impersonating another user
 */
export async function startImpersonation(
  adminUserId: string,
  targetUserId: string
): Promise<ImpersonationSession | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "start-impersonation",
      {
        body: { targetUserId },
      }
    );

    if (error) {
      logger.error("[ImpersonationService] Failed to start impersonation", error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error("[ImpersonationService] Error starting impersonation", error);
    return null;
  }
}

/**
 * End current impersonation session
 */
export async function endImpersonation(): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke("end-impersonation");

    if (error) {
      logger.error("[ImpersonationService] Failed to end impersonation", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[ImpersonationService] Error ending impersonation", error);
    return false;
  }
}

/**
 * Get active impersonation session
 */
export async function getActiveImpersonation(): Promise<ImpersonationSession | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "get-active-impersonation"
    );

    if (error) {
      return null;
    }

    return data;
  } catch (error) {
    logger.error("[ImpersonationService] Error getting active impersonation", error);
    return null;
  }
}
