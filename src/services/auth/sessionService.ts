import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Session Management Service
 * Handles session creation, validation, and cleanup
 */

export interface SessionInfo {
  sessionId: string;
  expiresAt: string;
  csrfToken: string;
}

/**
 * Create a new session in the database
 */
export async function createSession(
  userId: string,
  csrfToken: string,
  expiresAt: Date
): Promise<SessionInfo | null> {
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .upsert(
        {
          user_id: userId,
          csrf_token: csrfToken,
          expires_at: expiresAt.toISOString(),
          last_activity: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      logger.error("[SessionService] Failed to create session", error);
      return null;
    }

    return {
      sessionId: data.id,
      expiresAt: data.expires_at,
      csrfToken: data.csrf_token,
    };
  } catch (error) {
    logger.error("[SessionService] Error creating session", error);
    return null;
  }
}

/**
 * Get active session for user
 */
export async function getActiveSession(
  userId: string
): Promise<SessionInfo | null> {
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("id, csrf_token, expires_at")
      .eq("user_id", userId)
      .gte("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return null;
    }

    return {
      sessionId: data.id,
      expiresAt: data.expires_at,
      csrfToken: data.csrf_token,
    };
  } catch (error) {
    logger.error("[SessionService] Error getting active session", error);
    return null;
  }
}

/**
 * Delete session from database
 */
export async function deleteSession(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_sessions")
      .delete()
      .eq("user_id", userId);

    if (error) {
      logger.error("[SessionService] Failed to delete session", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[SessionService] Error deleting session", error);
    return false;
  }
}

/**
 * Check if session is expired
 */
export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date();
}

/**
 * Calculate session expiration time (60 minutes from now)
 */
export function calculateSessionExpiration(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}
