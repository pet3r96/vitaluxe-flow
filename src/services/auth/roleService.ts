import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { AppRole } from "@/integrations/supabase/types";

/**
 * Role Management Service
 * Handles user role queries and checks
 */

/**
 * Get user's role from database
 */
export async function getUserRole(userId: string): Promise<AppRole | null> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      logger.error("[RoleService] Failed to get user role", error);
      return null;
    }

    return data.role as AppRole;
  } catch (error) {
    logger.error("[RoleService] Error getting user role", error);
    return null;
  }
}

/**
 * Check if user has specific role
 */
export async function hasRole(
  userId: string,
  role: AppRole
): Promise<boolean> {
  try {
    const userRole = await getUserRole(userId);
    return userRole === role;
  } catch (error) {
    logger.error("[RoleService] Error checking role", error);
    return false;
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  return hasRole(userId, "admin");
}

/**
 * Check if user is staff
 */
export async function isStaff(userId: string): Promise<boolean> {
  return hasRole(userId, "staff");
}

/**
 * Check if user is topline
 */
export async function isTopline(userId: string): Promise<boolean> {
  return hasRole(userId, "topline");
}

/**
 * Get practice ID for provider user
 */
export async function getPracticeIdForProvider(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("providers")
      .select("practice_id")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.practice_id;
  } catch (error) {
    logger.error("[RoleService] Error getting practice ID for provider", error);
    return null;
  }
}

/**
 * Get practice ID for patient user
 */
export async function getPracticeIdForPatient(
  userId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("patient_accounts")
      .select("practice_id")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return null;
    }

    return data.practice_id;
  } catch (error) {
    logger.error("[RoleService] Error getting practice ID for patient", error);
    return null;
  }
}
