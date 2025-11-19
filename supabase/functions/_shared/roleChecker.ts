/**
 * Centralized Role Checker for Edge Functions
 * 
 * PHASE 2 WEEK 3: Standardized role checking across all edge functions
 * 
 * Usage:
 * ```typescript
 * import { hasRole, requireRole } from '../_shared/roleChecker.ts';
 * 
 * // Check if user has any of the allowed roles
 * const allowed = await hasRole(supabase, userId, ['admin', 'doctor']);
 * 
 * // Require role (throws error if not authorized)
 * await requireRole(supabase, userId, ['admin'], 'Admin access required');
 * ```
 */

import { createClient } from "npm:@supabase/supabase-js@2.74.0";
import { edgeLogger } from './logger.ts';

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Check if a user has any of the specified roles
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @param allowedRoles - Array of role names to check against
 * @returns Promise<boolean> - true if user has any of the allowed roles
 */
export async function hasRole(
  supabase: any,
  userId: string,
  allowedRoles: string[]
): Promise<boolean> {
  if (!userId || !allowedRoles || allowedRoles.length === 0) {
    return false;
  }

  try {
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      edgeLogger.error('Role check failed', error, { userId, allowedRoles });
      return false;
    }

    if (!roles || roles.length === 0) {
      return false;
    }

    // Check if user has any of the allowed roles
    return roles.some((r: any) => allowedRoles.includes(r.role));
  } catch (error) {
    edgeLogger.error('Role check exception', error as Error, { userId, allowedRoles });
    return false;
  }
}

/**
 * Require a user to have one of the specified roles (throws error if not authorized)
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @param allowedRoles - Array of role names to check against
 * @param errorMessage - Custom error message (optional)
 * @throws Error if user doesn't have required role
 */
export async function requireRole(
  supabase: any,
  userId: string,
  allowedRoles: string[],
  errorMessage = 'Insufficient permissions'
): Promise<void> {
  const allowed = await hasRole(supabase, userId, allowedRoles);
  
  if (!allowed) {
    edgeLogger.warn('Unauthorized access attempt', {
      userId,
      requiredRoles: allowedRoles,
      errorMessage
    });
    throw new Error(errorMessage);
  }
}

/**
 * Get all roles for a user
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID
 * @returns Promise<string[]> - Array of role names
 */
export async function getUserRoles(
  supabase: any,
  userId: string
): Promise<string[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data: roles, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      edgeLogger.error('Failed to fetch user roles', error, { userId });
      return [];
    }

    return roles?.map((r: any) => r.role) || [];
  } catch (error) {
    edgeLogger.error('Exception fetching user roles', error as Error, { userId });
    return [];
  }
}

/**
 * Check if user is an admin (admin or super_admin role)
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @returns Promise<boolean> - true if user is admin
 */
export async function isAdmin(
  supabase: any,
  userId: string
): Promise<boolean> {
  return await hasRole(supabase, userId, ['admin', 'super_admin']);
}

/**
 * Require admin access (throws error if not admin)
 * 
 * @param supabase - Supabase client instance
 * @param userId - User ID to check
 * @param errorMessage - Custom error message (optional)
 * @throws Error if user is not admin
 */
export async function requireAdmin(
  supabase: any,
  userId: string,
  errorMessage = 'Admin access required'
): Promise<void> {
  await requireRole(supabase, userId, ['admin', 'super_admin'], errorMessage);
}
