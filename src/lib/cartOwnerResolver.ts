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

  let resolvedId: string;

  // Providers and doctors use their own account
  if (role === 'provider' || role === 'doctor') {
    logger.info("Cart owner: provider using own user_id", { userId });
    resolvedId = userId;
  }
  // Staff users: use practice_id directly for shared practice cart
  else if (role === 'staff' && practiceId) {
    logger.info("Cart owner: staff using practice_id", { practiceId });
    resolvedId = practiceId;
  }
  // Practice users: use their own user_id (which should equal practice_id)
  else if (role === 'practice') {
    logger.info("Cart owner: practice user using own user_id", { userId });
    resolvedId = userId;
  }
  // Admin and other roles - use their own ID as fallback
  else {
    logger.info("Cart owner: fallback to user_id", { userId });
    resolvedId = userId;
  }

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
