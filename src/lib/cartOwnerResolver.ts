import { supabase } from "@/integrations/supabase/client";

// Cache to prevent repeated async calls with same inputs
const ownerCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Resolves the correct cart owner user_id for ordering
 * - Providers/doctors: use their own user_id
 * - Staff/practice: use practice_id for shared cart
 * - Cached for 30 seconds to prevent loops
 */
export async function resolveCartOwnerUserId(
  userId: string | null,
  role: string | null,
  practiceId?: string | null
): Promise<string | null> {
  if (!userId) return null;

  // Create cache key
  const cacheKey = `${userId}:${role}:${practiceId || 'none'}`;
  
  // Check cache
  const cached = ownerCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('[CartOwnerResolver] Using cached result:', cached.value);
    return cached.value;
  }

  console.log('[CartOwnerResolver] Input:', { userId, role, practiceId });

  let resolvedId: string;

  // Providers and doctors use their own account
  if (role === 'provider' || role === 'doctor') {
    console.log('[CartOwnerResolver] Provider/doctor - using own user_id:', userId);
    resolvedId = userId;
  }
  // Staff users: use practice_id directly for shared practice cart
  else if (role === 'staff' && practiceId) {
    console.log('[CartOwnerResolver] Staff - using practice_id for cart:', practiceId);
    resolvedId = practiceId;
  }
  // Practice users: use their own user_id (which should equal practice_id)
  else if (role === 'practice') {
    console.log('[CartOwnerResolver] Practice user - using own user_id:', userId);
    resolvedId = userId;
  }
  // Admin and other roles - use their own ID as fallback
  else {
    console.log('[CartOwnerResolver] Fallback to user_id:', userId);
    resolvedId = userId;
  }

  // Cache result
  ownerCache.set(cacheKey, { value: resolvedId, timestamp: Date.now() });

  return resolvedId;
}

// Clear cache when impersonation changes
if (typeof window !== 'undefined') {
  window.addEventListener('impersonation-changed', () => {
    console.log('[CartOwnerResolver] Clearing cache due to impersonation change');
    ownerCache.clear();
  });
}
