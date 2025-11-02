// Real-time NPI verification using CMS NPPES Registry API
// Documentation: https://npiregistry.cms.hhs.gov/api-page

import { supabase } from "@/integrations/supabase/client";

interface NPPESResult {
  number: string;
  enumeration_type: "NPI-1" | "NPI-2"; // NPI-1 = Individual, NPI-2 = Organization
  basic: {
    first_name?: string;
    last_name?: string;
    middle_name?: string;
    credential?: string;
    sole_proprietor?: string;
    gender?: string;
    enumeration_date?: string;
    last_updated?: string;
    status?: string;
    name?: string; // For organizations
    organizational_subpart?: string;
  };
  taxonomies?: Array<{
    code: string;
    desc: string;
    primary: boolean;
    state?: string;
    license?: string;
  }>;
  addresses?: Array<{
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country_code?: string;
    address_type?: string;
    telephone_number?: string;
  }>;
}

interface NPPESResponse {
  result_count: number;
  results: NPPESResult[];
}

export interface NPIVerificationResult {
  valid: boolean;
  npi?: string;
  type?: "individual" | "organization";
  providerName?: string;
  credential?: string;
  specialty?: string;
  status?: string;
  enumerationDate?: string;
  lastUpdated?: string;
  error?: string;
  warning?: string;
}

const CACHE_KEY_PREFIX = "npi_verification_";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get cached verification result
function getCachedResult(npi: string): NPIVerificationResult | null {
  try {
    const cached = sessionStorage.getItem(`${CACHE_KEY_PREFIX}${npi}`);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    const now = Date.now();

    if (now - parsed.timestamp < CACHE_DURATION_MS) {
      return parsed.result;
    }

    // Expired
    sessionStorage.removeItem(`${CACHE_KEY_PREFIX}${npi}`);
    return null;
  } catch {
    return null;
  }
}

// Cache verification result
function cacheResult(npi: string, result: NPIVerificationResult): void {
  try {
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}${npi}`,
      JSON.stringify({
        timestamp: Date.now(),
        result,
      })
    );
  } catch {
    // Silently fail if sessionStorage is full
  }
}

/**
 * Timeout wrapper for promises
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutValue: T
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(timeoutValue), timeoutMs))
  ]);
}

/**
 * Verify an NPI number against the official CMS NPPES Registry
 * @param npi - The 10-digit NPI number to verify
 * @returns Promise with verification result (ALWAYS includes npi field)
 */
export async function verifyNPI(npi: string): Promise<NPIVerificationResult> {
  // Basic format validation
  if (!npi || !/^\d{10}$/.test(npi)) {
    return {
      valid: false,
      npi, // Always include npi
      error: "NPI must be exactly 10 digits",
    };
  }

  // Check cache first
  const cached = getCachedResult(npi);
  if (cached) {
    return { ...cached, npi }; // Ensure npi is included
  }

  try {
    // Call edge function with 5-second timeout
    const verificationPromise = supabase.functions.invoke('verify-npi', {
      body: { npi }
    });

    const { data, error } = await withTimeout(
      verificationPromise,
      5000, // 5 seconds
      { 
        data: null, 
        error: { message: "Verification timed out" } 
      }
    );

    // Handle timeout
    if (error?.message === "Verification timed out") {
      console.error("NPI verification timed out after 5 seconds");
      return {
        valid: false,
        npi,
        error: "Verification timed out. Please try again.",
      };
    }

    if (error) {
      console.error("NPI verification edge function error:", error);
      return {
        valid: false,
        npi,
        error: "Could not verify NPI. Please try again.",
      };
    }

    // Edge function returns the full NPIVerificationResult
    if (data && typeof data === 'object') {
      const result = data as NPIVerificationResult;
      
      // ALWAYS normalize result to include npi field
      const normalizedResult = { ...result, npi };
      
      // If warning-only (registry unavailable), treat as terminal failed state
      if (result.warning && !result.valid) {
        normalizedResult.valid = false;
        normalizedResult.error = "Registry temporarily unavailable. Please try again.";
      }
      
      // Cache successful verifications only
      if (normalizedResult.valid && !normalizedResult.error) {
        cacheResult(npi, normalizedResult);
      }
      
      return normalizedResult;
    }

    // Unexpected response format
    return {
      valid: false,
      npi,
      error: "Unexpected response from verification service.",
    };
  } catch (error) {
    console.error("NPI verification error:", error);
    
    return {
      valid: false,
      npi,
      error: "Network error. Please check your connection and try again.",
    };
  }
}

/**
 * Debounced NPI verification for real-time input validation
 * Uses per-call token to prevent race conditions from stale callbacks
 */
let verificationTimeout: NodeJS.Timeout | null = null;
let callCounter = 0;

export function verifyNPIDebounced(
  npi: string,
  callback: (result: NPIVerificationResult) => void,
  debounceMs = 800
): void {
  if (verificationTimeout) {
    clearTimeout(verificationTimeout);
  }

  // Generate unique call ID for this invocation
  const callId = ++callCounter;

  // Basic format check first
  if (!npi || npi.length < 10) {
    callback({ valid: false, npi, error: "" }); // No error for incomplete input
    return;
  }

  if (!/^\d{10}$/.test(npi)) {
    callback({ valid: false, npi, error: "NPI must be exactly 10 digits" });
    return;
  }

  verificationTimeout = setTimeout(async () => {
    // Only proceed if this is still the latest call
    if (callId === callCounter) {
      const result = await verifyNPI(npi);
      // Final safety check before callback
      if (callId === callCounter) {
        callback(result);
      }
    }
  }, debounceMs);
}
