/**
 * VIOS API Client
 * 
 * Handles OAuth token management and authenticated API requests.
 * Token caching: 14-minute lifetime (1-minute buffer before 15-min expiry)
 * Rate limiting: 1 second between requests per VIOS guidelines
 */

import { edgeLogger } from '../logger.ts';
import { VIOS_API_URL, TOKEN_TTL_MS, MIN_REQUEST_INTERVAL_MS, VIOS_ENABLED } from './viosConfig.ts';
import type { ViosTokenResponse, ViosConnectionStatus } from './viosTypes.ts';

interface CachedToken {
  token: string;
  expiresAt: number;
}

// Module-level token cache
let cachedToken: CachedToken | null = null;
let lastRequestTime = 0;

/**
 * Check if VIOS integration is enabled
 */
export function isViosEnabled(): boolean {
  return VIOS_ENABLED;
}

/**
 * Get VIOS credentials from environment
 */
function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = Deno.env.get("VIOS_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("VIOS_CLIENT_SECRET")?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("VIOS credentials not configured (VIOS_CLIENT_ID and VIOS_CLIENT_SECRET required)");
  }

  return { clientId, clientSecret };
}

/**
 * Get a valid VIOS OAuth token
 * Returns cached token if still valid, otherwise fetches a new one
 */
export async function getViosToken(): Promise<string> {
  if (!VIOS_ENABLED) {
    throw new Error("VIOS integration is disabled");
  }

  // Return cached token if still valid (with 1-minute safety buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    edgeLogger.info("Using cached VIOS token", { 
      expiresIn: Math.round((cachedToken.expiresAt - Date.now()) / 1000) + "s" 
    });
    return cachedToken.token;
  }

  const { clientId, clientSecret } = getCredentials();

  edgeLogger.info("Fetching new VIOS OAuth token", {
    clientIdLength: clientId.length,
    clientSecretLength: clientSecret.length,
  });

  // VIOS uses header-based client credentials per their OpenAPI spec
  const response = await fetch(`${VIOS_API_URL}/api/auth/token`, {
    method: "POST",
    headers: {
      "ClientId": clientId,
      "ClientSecret": clientSecret,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    edgeLogger.error("VIOS token request failed", { 
      status: response.status, 
      error: errorText 
    });
    throw new Error(`VIOS authentication failed: ${response.status} - ${errorText}`);
  }

  const tokenData: ViosTokenResponse = await response.json();
  const accessToken = tokenData.accessToken;

  if (!accessToken) {
    edgeLogger.error("No access token in VIOS response", { tokenData });
    throw new Error("Failed to obtain VIOS access token");
  }

  // Cache the token
  cachedToken = {
    token: accessToken,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  };

  edgeLogger.info("VIOS OAuth token obtained and cached", {
    expiresIn: "14 minutes"
  });

  return accessToken;
}

/**
 * Clear the cached token (useful for forced refresh)
 */
export function clearViosTokenCache(): void {
  cachedToken = null;
  edgeLogger.info("VIOS token cache cleared");
}

/**
 * Check connection status and token validity
 */
export async function getViosConnectionStatus(): Promise<ViosConnectionStatus> {
  if (!VIOS_ENABLED) {
    return {
      connected: false,
      tokenValid: false,
      error: "VIOS integration is disabled"
    };
  }

  try {
    const { clientId, clientSecret } = getCredentials();
    
    if (!clientId || !clientSecret) {
      return {
        connected: false,
        tokenValid: false,
        error: "VIOS credentials not configured"
      };
    }

    // Try to get or refresh token
    const token = await getViosToken();
    
    return {
      connected: true,
      tokenValid: true,
      tokenExpiresIn: cachedToken ? Math.round((cachedToken.expiresAt - Date.now()) / 1000) : undefined,
      lastSuccessfulCall: new Date().toISOString()
    };
  } catch (error) {
    return {
      connected: false,
      tokenValid: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

/**
 * Make an authenticated request to VIOS API
 * Handles token refresh automatically on 401 errors
 */
export async function viosApiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    retryOnAuthError?: boolean;
  } = {}
): Promise<T> {
  if (!VIOS_ENABLED) {
    throw new Error("VIOS integration is disabled");
  }

  const { method = 'GET', body, retryOnAuthError = true } = options;

  const token = await getViosToken();

  const requestOptions: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  const url = `${VIOS_API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  edgeLogger.info("VIOS API request", { method, endpoint });

  const response = await fetch(url, requestOptions);

  // Handle 401 by clearing cache and retrying once
  if (response.status === 401 && retryOnAuthError) {
    edgeLogger.warn("VIOS token expired, refreshing and retrying");
    clearViosTokenCache();
    return viosApiRequest<T>(endpoint, { ...options, retryOnAuthError: false });
  }

  if (!response.ok) {
    const errorText = await response.text();
    edgeLogger.error("VIOS API error", new Error(`${response.status}: ${errorText}`), { 
      status: response.status, 
      endpoint,
      responseBody: errorText 
    });
    throw new Error(`VIOS API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data as T;
}

/**
 * Make a rate-limited authenticated request to VIOS API
 * Adds 1 second delay between requests per VIOS guidelines
 */
export async function throttledViosApiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    retryOnAuthError?: boolean;
  } = {}
): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => 
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest)
    );
  }
  
  lastRequestTime = Date.now();
  return viosApiRequest<T>(endpoint, options);
}

export { VIOS_API_URL };
