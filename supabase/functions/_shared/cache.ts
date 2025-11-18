/**
 * Redis Cache Layer with PHI Protection
 * 
 * CRITICAL: This cache layer explicitly blocks caching of Protected Health Information (PHI)
 * to maintain HIPAA compliance. Any attempt to cache patient medical vault data will throw an error.
 */

const UPSTASH_REDIS_REST_URL = Deno.env.get('UPSTASH_REDIS_REST_URL');
const UPSTASH_REDIS_REST_TOKEN = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

// PHI patterns that should NEVER be cached
const PHI_PATTERNS = [
  /patient_medical_vault/i,
  /vault_grouped/i,
  /medical_chart/i,
  /patientMedicalDataService/i,
  /medications/i,
  /conditions/i,
  /allergies/i,
  /vitals/i,
  /immunizations/i,
  /surgeries/i,
  /prescriptions/i,
  /diagnosis/i,
  /provider_notes/i,
];

/**
 * Check if a cache key contains PHI data
 */
function isPHIKey(key: string): boolean {
  return PHI_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Sanitize key for logging (remove sensitive parts)
 */
function sanitizeKey(key: string): string {
  // Remove UUIDs and potentially sensitive IDs
  return key.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>');
}

/**
 * Get value from Redis cache
 */
export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  // PHI protection check
  if (isPHIKey(key)) {
    console.error(`🚨 PHI VIOLATION BLOCKED: Attempted to get PHI data from cache: ${sanitizeKey(key)}`);
    throw new Error('PHI data cannot be cached');
  }

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis not configured, skipping cache get');
    return null;
  }

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Cache get failed: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (data.result === null) {
      console.log(`Cache miss: ${sanitizeKey(key)}`);
      return null;
    }

    console.log(`Cache hit: ${sanitizeKey(key)}`);
    return JSON.parse(data.result) as T;
  } catch (error) {
    console.error(`Cache get error for ${sanitizeKey(key)}:`, error);
    return null;
  }
}

/**
 * Set value in Redis cache with TTL
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds: number = 300): Promise<boolean> {
  // PHI protection check
  if (isPHIKey(key)) {
    console.error(`🚨 PHI VIOLATION BLOCKED: Attempted to set PHI data in cache: ${sanitizeKey(key)}`);
    throw new Error('PHI data cannot be cached');
  }

  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Redis not configured, skipping cache set');
    return false;
  }

  try {
    const serialized = JSON.stringify(value);
    
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/setex/${key}/${ttlSeconds}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
      body: serialized,
    });

    if (!response.ok) {
      console.error(`Cache set failed: ${response.status}`);
      return false;
    }

    console.log(`Cache set: ${sanitizeKey(key)} (TTL: ${ttlSeconds}s)`);
    return true;
  } catch (error) {
    console.error(`Cache set error for ${sanitizeKey(key)}:`, error);
    return false;
  }
}

/**
 * Delete value from Redis cache
 */
export async function cacheDel(key: string): Promise<boolean> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return false;
  }

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/del/${key}`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (!response.ok) {
      console.error(`Cache del failed: ${response.status}`);
      return false;
    }

    console.log(`Cache del: ${sanitizeKey(key)}`);
    return true;
  } catch (error) {
    console.error(`Cache del error for ${sanitizeKey(key)}:`, error);
    return false;
  }
}

/**
 * Delete all keys matching pattern (for invalidation)
 */
export async function cacheDelPattern(pattern: string): Promise<number> {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return 0;
  }

  try {
    // Scan for keys matching pattern
    const scanResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/scan/0/MATCH/${pattern}`, {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    });

    if (!scanResponse.ok) {
      console.error(`Cache scan failed: ${scanResponse.status}`);
      return 0;
    }

    const scanData = await scanResponse.json();
    const keys = scanData.result?.[1] || [];

    if (keys.length === 0) {
      console.log(`No keys found matching pattern: ${pattern}`);
      return 0;
    }

    // Delete all found keys
    let deletedCount = 0;
    for (const key of keys) {
      const deleted = await cacheDel(key);
      if (deleted) deletedCount++;
    }

    console.log(`Invalidated ${deletedCount} keys matching: ${pattern}`);
    return deletedCount;
  } catch (error) {
    console.error(`Cache del pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Cache-aside pattern helper
 * Tries cache first, falls back to fetcher function
 */
export async function cacheFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  // Try cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch fresh data
  const fresh = await fetcher();
  
  // Store in cache (fire and forget)
  cacheSet(key, fresh, ttlSeconds).catch(err => 
    console.error('Background cache set failed:', err)
  );

  return fresh;
}
