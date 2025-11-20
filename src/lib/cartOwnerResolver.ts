import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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
    logger.info("Using cached cart owner result", { userId });
    return cached.value;
  }

  logger.info("Resolving cart owner", { userId, role, practiceId });

  // CRITICAL FIX: Every user gets their OWN isolated cart
  // No more shared carts - prevents cross-user contamination
  logger.info("Cart owner: user using own user_id", { userId, role });
  const resolvedId = userId;

  // Cache result
  ownerCache.set(cacheKey, { value: resolvedId, timestamp: Date.now() });

  return resolvedId;
}

// Clear cache when impersonation changes
if (typeof window !== 'undefined') {
  window.addEventListener('impersonation-changed', () => {
    logger.info("Clearing cart owner cache due to impersonation change");
    ownerCache.clear();
  });
}
