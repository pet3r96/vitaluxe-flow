import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves the correct cart owner user_id for ordering
 * - Providers/doctors: use their own user_id
 * - Staff/practice: use the first active provider's user_id from their practice
 */
export async function resolveCartOwnerUserId(
  userId: string,
  role: string,
  practiceId?: string | null
): Promise<string | null> {
  console.log('[CartOwnerResolver] Input:', { userId, role, practiceId });

  // Providers and doctors use their own account
  if (role === 'provider' || role === 'doctor') {
    console.log('[CartOwnerResolver] Provider/doctor - using own user_id:', userId);
    return userId;
  }

  // Staff users: use practice_id directly for shared practice cart
  if (role === 'staff' && practiceId) {
    console.log('[CartOwnerResolver] Staff - using practice_id for cart:', practiceId);
    return practiceId;
  }

  // Practice users: use their own user_id (which should equal practice_id)
  if (role === 'practice') {
    console.log('[CartOwnerResolver] Practice user - using own user_id:', userId);
    return userId;
  }

  // Admin and other roles - use their own ID as fallback
  console.log('[CartOwnerResolver] Fallback to user_id:', userId);
  return userId;
}
