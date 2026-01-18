/**
 * VIOS API Authentication Helper
 * 
 * Handles OAuth token management with 14-minute caching (tokens expire at 15 min)
 * Provides auto-refresh on expiration for seamless API calls
 */

import { edgeLogger } from './logger.ts';

const VIOS_API_URL = "https://integrationapi.vioscompounding.com";
const TOKEN_TTL_MS = 14 * 60 * 1000; // 14 minutes (1 minute buffer before 15-min expiry)

interface CachedToken {
  token: string;
  expiresAt: number;
}

// Module-level token cache
let cachedToken: CachedToken | null = null;

/**
 * Get a valid VIOS OAuth token
 * Returns cached token if still valid, otherwise fetches a new one
 */
export async function getViosToken(): Promise<string> {
  // Return cached token if still valid (with 1-minute safety buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    edgeLogger.info("Using cached VIOS token", { 
      expiresIn: Math.round((cachedToken.expiresAt - Date.now()) / 1000) + "s" 
    });
    return cachedToken.token;
  }

  // Fetch new token from VIOS using their /api/auth/token endpoint
  const viosClientId = Deno.env.get("VIOS_CLIENT_ID")?.trim();
  const viosClientSecret = Deno.env.get("VIOS_CLIENT_SECRET")?.trim();

  if (!viosClientId || !viosClientSecret) {
    throw new Error("VIOS credentials not configured (VIOS_CLIENT_ID and VIOS_CLIENT_SECRET required)");
  }

  edgeLogger.info("Fetching new VIOS OAuth token", {
    clientIdLength: viosClientId.length,
    clientSecretLength: viosClientSecret.length,
  });

  // VIOS uses header-based client credentials per their OpenAPI spec
  const response = await fetch(`${VIOS_API_URL}/api/auth/token`, {
    method: "POST",
    headers: {
      "ClientId": viosClientId,
      "ClientSecret": viosClientSecret,
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

  const tokenData = await response.json();
  // VIOS returns { accessToken: "..." } per their OpenAPI spec
  const accessToken = tokenData.accessToken || tokenData.access_token;

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
    edgeLogger.error("VIOS API error", { 
      status: response.status, 
      endpoint,
      error: errorText 
    });
    throw new Error(`VIOS API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data as T;
}

export { VIOS_API_URL };
