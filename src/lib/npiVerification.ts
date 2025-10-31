// Real-time NPI verification using CMS NPPES Registry API
// Documentation: https://npiregistry.cms.hhs.gov/api-page

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
 * Verify an NPI number against the official CMS NPPES Registry
 * @param npi - The 10-digit NPI number to verify
 * @returns Promise with verification result
 */
export async function verifyNPI(npi: string): Promise<NPIVerificationResult> {
  // Basic format validation
  if (!npi || !/^\d{10}$/.test(npi)) {
    return {
      valid: false,
      error: "NPI must be exactly 10 digits",
    };
  }

  // Check cache first
  const cached = getCachedResult(npi);
  if (cached) {
    return cached;
  }

  try {
    // Call NPPES API
    const response = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      // API error - allow submission with warning
      const result: NPIVerificationResult = {
        valid: true,
        npi,
        warning: "Could not verify NPI - registry temporarily unavailable. Please verify manually.",
      };
      return result;
    }

    const data: NPPESResponse = await response.json();

    // No results found
    if (data.result_count === 0 || !data.results || data.results.length === 0) {
      const result: NPIVerificationResult = {
        valid: false,
        error: "NPI not found in NPPES registry",
      };
      cacheResult(npi, result);
      return result;
    }

    // Parse result
    const provider = data.results[0];
    const isIndividual = provider.enumeration_type === "NPI-1";
    const isOrganization = provider.enumeration_type === "NPI-2";

    let providerName = "";
    if (isIndividual) {
      const parts = [
        provider.basic.first_name,
        provider.basic.middle_name,
        provider.basic.last_name,
        provider.basic.credential,
      ].filter(Boolean);
      providerName = parts.join(" ");
    } else if (isOrganization) {
      providerName = provider.basic.name || "";
    }

    // Get primary taxonomy (specialty)
    const primaryTaxonomy = provider.taxonomies?.find((t) => t.primary);
    const specialty = primaryTaxonomy?.desc || "";

    const result: NPIVerificationResult = {
      valid: true,
      npi,
      type: isIndividual ? "individual" : "organization",
      providerName: providerName.trim(),
      credential: provider.basic.credential,
      specialty,
      status: provider.basic.status,
      enumerationDate: provider.basic.enumeration_date,
      lastUpdated: provider.basic.last_updated,
    };

    // Add warning if NPI is deactivated
    if (provider.basic.status?.toLowerCase() === "deactivated") {
      result.warning = "This NPI has been deactivated in the registry";
    }

    // Cache the result
    cacheResult(npi, result);
    return result;
  } catch (error) {
    console.error("NPI verification error:", error);
    
    // Network error - allow submission with warning
    const result: NPIVerificationResult = {
      valid: true,
      npi,
      warning: "Could not verify NPI - network error. Please verify manually.",
    };
    return result;
  }
}

/**
 * Debounced NPI verification for real-time input validation
 */
let verificationTimeout: NodeJS.Timeout | null = null;

export function verifyNPIDebounced(
  npi: string,
  callback: (result: NPIVerificationResult) => void,
  debounceMs = 800
): void {
  if (verificationTimeout) {
    clearTimeout(verificationTimeout);
  }

  // Basic format check first
  if (!npi || npi.length < 10) {
    callback({ valid: false, error: "" }); // No error for incomplete input
    return;
  }

  if (!/^\d{10}$/.test(npi)) {
    callback({ valid: false, error: "NPI must be exactly 10 digits" });
    return;
  }

  verificationTimeout = setTimeout(async () => {
    const result = await verifyNPI(npi);
    callback(result);
  }, debounceMs);
}
