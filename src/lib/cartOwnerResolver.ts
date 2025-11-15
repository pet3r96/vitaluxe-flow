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

  // Staff and practice users need their practice's provider
  if ((role === 'staff' || role === 'practice') && practiceId) {
    console.log('[CartOwnerResolver] Staff/practice - looking up provider for practice:', practiceId);
    
    const { data: provider, error } = await supabase
      .from('providers')
      .select('user_id')
      .eq('practice_id', practiceId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[CartOwnerResolver] Error fetching provider:', error);
      return null;
    }

    if (!provider) {
      console.warn('[CartOwnerResolver] No active provider found for practice:', practiceId);
      
      // CRITICAL FIX: Check if this staff user IS a provider themselves
      const { data: staffAsProvider, error: providerError } = await supabase
        .from('providers')
        .select('user_id, practice_id')
        .eq('user_id', userId)
        .eq('active', true)
        .maybeSingle();
      
      if (!providerError && staffAsProvider) {
        console.log('[CartOwnerResolver] Staff IS a provider - using their user_id:', userId);
        return userId;
      }
      
      console.error('[CartOwnerResolver] CRITICAL: No provider found for staff/practice user. practiceId:', practiceId, 'userId:', userId);
      return null;
    }

    console.log('[CartOwnerResolver] Resolved to provider user_id:', provider.user_id);
    return provider.user_id;
  }

  // Admin and other roles - use their own ID as fallback
  console.log('[CartOwnerResolver] Fallback to user_id:', userId);
  return userId;
}
