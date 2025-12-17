/**
 * Pharmacy API Client
 * 
 * Server-side only API client with:
 * - OAuth token management with caching and auto-refresh
 * - PHI-safe logging (no PHI written to logs)
 * - Idempotency support (prevent duplicate order submissions)
 * - Sandbox/Production environment support
 * - Modular and reusable design
 */

import { createAdminClient } from './supabaseAdmin.ts';
import { edgeLogger } from './logger.ts';
import { cacheGet, cacheSet } from './cache.ts';

// PHI fields that should never be logged
const PHI_FIELDS = [
  'patient_name', 'patient_address', 'patient_phone', 'patient_email',
  'allergies', 'notes', 'prescription_url', 'custom_dosage', 'custom_sig',
  'npi', 'dea', 'license_number', 'ssn', 'date_of_birth', 'birth_date'
];

interface TokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface PharmacyApiConfig {
  pharmacy_id: string;
  environment: 'sandbox' | 'production';
  token_endpoint_url?: string;
  api_endpoint_url: string;
  sandbox_endpoint_url?: string;
  production_endpoint_url?: string;
  client_id?: string;
  client_secret?: string;
  auth_type: 'none' | 'bearer' | 'api_key' | 'basic' | 'oauth2';
  auth_key_name?: string;
  http_method: string;
  retry_count: number;
  timeout_seconds: number;
  custom_headers?: Record<string, string>;
  payload_template?: Record<string, any>;
}

interface IdempotencyResult {
  is_duplicate: boolean;
  existing_response?: {
    status: number;
    body: any;
    pharmacy_order_id?: string;
  };
  idempotency_key: string;
}

interface ApiRequestOptions {
  idempotency_key?: string;
  order_id: string;
  order_line_id?: string;
}

/**
 * Sanitize payload for logging - removes PHI fields
 */
export function sanitizeForLogging(data: any): any {
  if (data === null || data === undefined) return data;
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForLogging(item));
  }
  
  if (typeof data === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (PHI_FIELDS.some(phi => lowerKey.includes(phi))) {
        sanitized[key] = '[PHI_REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
  
  return data;
}

/**
 * Generate a hash for request deduplication
 */
function generateRequestHash(payload: any): string {
  const str = JSON.stringify(payload);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Pharmacy API Client Class
 */
export class PharmacyApiClient {
  private supabaseAdmin = createAdminClient();
  private config: PharmacyApiConfig;
  private credentials: any[] = [];

  constructor(config: PharmacyApiConfig) {
    this.config = config;
  }

  /**
   * Load API credentials from database
   */
  async loadCredentials(): Promise<void> {
    const { data } = await this.supabaseAdmin
      .from('pharmacy_api_credentials')
      .select('*')
      .eq('pharmacy_id', this.config.pharmacy_id);
    
    this.credentials = data || [];
  }

  /**
   * Get the appropriate endpoint URL based on environment
   */
  getEndpointUrl(): string {
    const { environment, api_endpoint_url, sandbox_endpoint_url, production_endpoint_url } = this.config;
    
    if (environment === 'production' && production_endpoint_url) {
      return production_endpoint_url;
    }
    if (environment === 'sandbox' && sandbox_endpoint_url) {
      return sandbox_endpoint_url;
    }
    return api_endpoint_url;
  }

  /**
   * Get OAuth token with caching and auto-refresh
   */
  async getOAuthToken(): Promise<string | null> {
    const { pharmacy_id, environment, token_endpoint_url, client_id, client_secret } = this.config;
    
    if (!token_endpoint_url || !client_id) {
      return null;
    }

    const cacheKey = `pharmacy_token:${pharmacy_id}:${environment}`;
    
    // Check cache first (Redis)
    const cachedToken = await cacheGet<{ token: string; expires_at: string }>(cacheKey);
    if (cachedToken) {
      const expiresAt = new Date(cachedToken.expires_at);
      // Return if token has more than 5 minutes remaining
      if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
        edgeLogger.info('Using cached OAuth token', { pharmacy_id, environment });
        return cachedToken.token;
      }
    }

    // Check database token cache
    const { data: dbToken } = await this.supabaseAdmin
      .from('pharmacy_api_tokens')
      .select('*')
      .eq('pharmacy_id', pharmacy_id)
      .eq('environment', environment)
      .single();

    if (dbToken) {
      const expiresAt = new Date(dbToken.expires_at);
      // Use if token has more than 5 minutes remaining
      if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
        // Cache in Redis for faster access
        await cacheSet(cacheKey, {
          token: dbToken.access_token,
          expires_at: dbToken.expires_at
        }, Math.floor((expiresAt.getTime() - Date.now()) / 1000) - 300);
        
        edgeLogger.info('Using database cached OAuth token', { pharmacy_id, environment });
        return dbToken.access_token;
      }

      // Try to refresh using refresh token
      if (dbToken.refresh_token) {
        const refreshedToken = await this.refreshOAuthToken(dbToken.refresh_token);
        if (refreshedToken) return refreshedToken;
      }
    }

    // Request new token
    return await this.requestNewOAuthToken();
  }

  /**
   * Request new OAuth token from auth endpoint
   */
  private async requestNewOAuthToken(): Promise<string | null> {
    const { pharmacy_id, environment, token_endpoint_url, client_id, client_secret } = this.config;
    
    if (!token_endpoint_url || !client_id) return null;

    edgeLogger.info('Requesting new OAuth token', { pharmacy_id, environment });

    try {
      const response = await fetch(token_endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id,
          ...(client_secret && { client_secret }),
        }),
      });

      if (!response.ok) {
        edgeLogger.error('OAuth token request failed', new Error(`HTTP ${response.status}`), { 
          pharmacy_id, 
          environment,
          status: response.status 
        });
        return null;
      }

      const tokenData: TokenResponse = await response.json();
      
      // Calculate expiration (default to 1 hour if not specified)
      const expiresIn = tokenData.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Store in database
      await this.supabaseAdmin
        .from('pharmacy_api_tokens')
        .upsert({
          pharmacy_id,
          environment,
          access_token: tokenData.access_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_at: expiresAt.toISOString(),
          refresh_token: tokenData.refresh_token,
          scope: tokenData.scope,
        }, {
          onConflict: 'pharmacy_id,environment'
        });

      // Cache in Redis
      const cacheKey = `pharmacy_token:${pharmacy_id}:${environment}`;
      await cacheSet(cacheKey, {
        token: tokenData.access_token,
        expires_at: expiresAt.toISOString()
      }, expiresIn - 300); // Cache for slightly less than expiry

      edgeLogger.info('OAuth token obtained and cached', { pharmacy_id, environment });
      return tokenData.access_token;

    } catch (error) {
      edgeLogger.error('OAuth token request error', error instanceof Error ? error : new Error(String(error)), {
        pharmacy_id,
        environment
      });
      return null;
    }
  }

  /**
   * Refresh OAuth token using refresh token
   */
  private async refreshOAuthToken(refreshToken: string): Promise<string | null> {
    const { pharmacy_id, environment, token_endpoint_url, client_id, client_secret } = this.config;
    
    if (!token_endpoint_url || !client_id) return null;

    edgeLogger.info('Refreshing OAuth token', { pharmacy_id, environment });

    try {
      const response = await fetch(token_endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id,
          ...(client_secret && { client_secret }),
        }),
      });

      if (!response.ok) {
        edgeLogger.warn('OAuth token refresh failed, will request new token', { pharmacy_id, environment });
        return null;
      }

      const tokenData: TokenResponse = await response.json();
      const expiresIn = tokenData.expires_in || 3600;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      // Update in database
      await this.supabaseAdmin
        .from('pharmacy_api_tokens')
        .update({
          access_token: tokenData.access_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_at: expiresAt.toISOString(),
          refresh_token: tokenData.refresh_token || refreshToken,
          scope: tokenData.scope,
        })
        .eq('pharmacy_id', pharmacy_id)
        .eq('environment', environment);

      // Update Redis cache
      const cacheKey = `pharmacy_token:${pharmacy_id}:${environment}`;
      await cacheSet(cacheKey, {
        token: tokenData.access_token,
        expires_at: expiresAt.toISOString()
      }, expiresIn - 300);

      return tokenData.access_token;

    } catch (error) {
      edgeLogger.error('OAuth token refresh error', error instanceof Error ? error : new Error(String(error)), {
        pharmacy_id,
        environment
      });
      return null;
    }
  }

  /**
   * Build authentication headers based on auth type
   */
  async buildAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add custom headers
    if (this.config.custom_headers) {
      for (const [key, value] of Object.entries(this.config.custom_headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }
    }

    const { auth_type, auth_key_name } = this.config;

    switch (auth_type) {
      case 'oauth2': {
        const token = await this.getOAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
      }
      case 'bearer': {
        const bearerToken = this.credentials.find(c => c.credential_type === 'bearer_token')?.credential_key;
        if (bearerToken) {
          headers['Authorization'] = `Bearer ${bearerToken}`;
        }
        break;
      }
      case 'api_key': {
        const apiKey = this.credentials.find(c => c.credential_type === 'api_key')?.credential_key;
        const keyName = auth_key_name || 'X-API-Key';
        if (apiKey) {
          headers[keyName] = apiKey;
        }
        break;
      }
      case 'basic': {
        const username = this.credentials.find(c => c.credential_type === 'basic_auth_username')?.credential_key;
        const password = this.credentials.find(c => c.credential_type === 'basic_auth_password')?.credential_key;
        if (username && password) {
          headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
        }
        break;
      }
    }

    return headers;
  }

  /**
   * Check idempotency - returns existing response if duplicate
   */
  async checkIdempotency(
    idempotencyKey: string,
    orderId: string,
    orderLineId: string | undefined,
    requestHash: string
  ): Promise<IdempotencyResult> {
    const { pharmacy_id } = this.config;

    // Check for existing idempotency record
    const { data: existing } = await this.supabaseAdmin
      .from('pharmacy_idempotency_keys')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('pharmacy_id', pharmacy_id)
      .single();

    if (existing) {
      // If request is completed or failed, return existing result
      if (existing.status === 'completed' || existing.status === 'failed') {
        edgeLogger.info('Idempotent request - returning cached response', {
          pharmacy_id,
          idempotency_key: idempotencyKey,
          status: existing.status
        });
        
        return {
          is_duplicate: true,
          existing_response: {
            status: existing.response_status,
            body: existing.response_body,
            pharmacy_order_id: existing.pharmacy_order_id
          },
          idempotency_key: idempotencyKey
        };
      }

      // If still processing, also return as duplicate
      if (existing.status === 'processing') {
        edgeLogger.warn('Request still processing', { 
          pharmacy_id, 
          idempotency_key: idempotencyKey 
        });
        return {
          is_duplicate: true,
          existing_response: undefined,
          idempotency_key: idempotencyKey
        };
      }
    }

    // Create new idempotency record
    await this.supabaseAdmin
      .from('pharmacy_idempotency_keys')
      .insert({
        idempotency_key: idempotencyKey,
        pharmacy_id,
        order_id: orderId,
        order_line_id: orderLineId,
        request_hash: requestHash,
        status: 'processing'
      });

    return {
      is_duplicate: false,
      idempotency_key: idempotencyKey
    };
  }

  /**
   * Update idempotency record with result
   */
  async updateIdempotencyResult(
    idempotencyKey: string,
    status: 'completed' | 'failed',
    responseStatus: number,
    responseBody: any,
    pharmacyOrderId?: string
  ): Promise<void> {
    await this.supabaseAdmin
      .from('pharmacy_idempotency_keys')
      .update({
        status,
        response_status: responseStatus,
        response_body: responseBody,
        pharmacy_order_id: pharmacyOrderId,
        completed_at: new Date().toISOString()
      })
      .eq('idempotency_key', idempotencyKey)
      .eq('pharmacy_id', this.config.pharmacy_id);
  }

  /**
   * Send API request with retry logic, idempotency, and PHI protection
   */
  async sendRequest(
    payload: any,
    options: ApiRequestOptions
  ): Promise<{ success: boolean; response?: any; error?: string }> {
    const { pharmacy_id, environment, http_method, retry_count, timeout_seconds } = this.config;
    const endpoint = this.getEndpointUrl();

    // Generate idempotency key if not provided
    const idempotencyKey = options.idempotency_key || 
      `${options.order_id}_${options.order_line_id || 'batch'}_${Date.now()}`;
    
    const requestHash = generateRequestHash(payload);

    // Check idempotency
    const idempotencyResult = await this.checkIdempotency(
      idempotencyKey,
      options.order_id,
      options.order_line_id,
      requestHash
    );

    if (idempotencyResult.is_duplicate && idempotencyResult.existing_response) {
      return {
        success: idempotencyResult.existing_response.status < 400,
        response: idempotencyResult.existing_response.body
      };
    }

    if (idempotencyResult.is_duplicate) {
      return {
        success: false,
        error: 'Request is already being processed'
      };
    }

    // Log request (PHI sanitized)
    edgeLogger.info('Sending pharmacy API request', {
      pharmacy_id,
      environment,
      endpoint,
      method: http_method,
      order_id: options.order_id,
      idempotency_key: idempotencyKey
    });

    await this.loadCredentials();
    const headers = await this.buildAuthHeaders();

    let lastError = '';
    let responseStatus: number | null = null;
    let responseBody: any = null;

    for (let attempt = 0; attempt < retry_count; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout_seconds * 1000);

        const response = await fetch(endpoint, {
          method: http_method,
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        responseStatus = response.status;

        const responseText = await response.text();
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = { text: responseText };
        }

        if (response.ok) {
          // Extract pharmacy order ID
          const pharmacyOrderId = 
            responseBody?.order_id ||
            responseBody?.pharmacy_order_id ||
            responseBody?.id ||
            responseBody?.data?.order_id ||
            responseBody?.data?.id;

          // Update idempotency record
          await this.updateIdempotencyResult(
            idempotencyKey,
            'completed',
            responseStatus,
            responseBody,
            pharmacyOrderId ? String(pharmacyOrderId) : undefined
          );

          edgeLogger.info('Pharmacy API request successful', {
            pharmacy_id,
            environment,
            attempt: attempt + 1,
            pharmacy_order_id: pharmacyOrderId
          });

          return { success: true, response: responseBody };
        }

        lastError = `HTTP ${responseStatus}: ${JSON.stringify(sanitizeForLogging(responseBody))}`;

        // Don't retry 4xx errors
        if (responseStatus >= 400 && responseStatus < 500) {
          break;
        }

        // Exponential backoff
        if (attempt < retry_count - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        edgeLogger.error('Pharmacy API request attempt failed', 
          error instanceof Error ? error : new Error(String(error)), 
          { pharmacy_id, environment, attempt: attempt + 1 }
        );

        if (attempt < retry_count - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // Update idempotency record with failure
    await this.updateIdempotencyResult(
      idempotencyKey,
      'failed',
      responseStatus || 0,
      responseBody || { error: lastError }
    );

    edgeLogger.error('Pharmacy API request failed after all retries', new Error(lastError), {
      pharmacy_id,
      environment,
      retry_count
    });

    return { success: false, error: lastError };
  }
}

/**
 * Create a pharmacy API client from pharmacy ID
 */
export async function createPharmacyClient(pharmacyId: string): Promise<PharmacyApiClient | null> {
  const supabaseAdmin = createAdminClient();
  
  const { data: pharmacy, error } = await supabaseAdmin
    .from('pharmacies')
    .select('*')
    .eq('id', pharmacyId)
    .single();

  if (error || !pharmacy) {
    edgeLogger.error('Failed to load pharmacy config', error || new Error('Pharmacy not found'), { pharmacyId });
    return null;
  }

  if (!pharmacy.api_enabled) {
    edgeLogger.info('Pharmacy API not enabled', { pharmacyId });
    return null;
  }

  const config: PharmacyApiConfig = {
    pharmacy_id: pharmacyId,
    environment: pharmacy.api_environment || 'sandbox',
    token_endpoint_url: pharmacy.api_token_endpoint_url,
    api_endpoint_url: pharmacy.api_endpoint_url,
    sandbox_endpoint_url: pharmacy.api_sandbox_endpoint_url,
    production_endpoint_url: pharmacy.api_production_endpoint_url,
    client_id: pharmacy.api_client_id,
    client_secret: pharmacy.api_client_secret_encrypted,
    auth_type: pharmacy.api_auth_type || 'none',
    auth_key_name: pharmacy.api_auth_key_name,
    http_method: pharmacy.api_http_method || 'POST',
    retry_count: pharmacy.api_retry_count || 3,
    timeout_seconds: pharmacy.api_timeout_seconds || 30,
    custom_headers: pharmacy.api_custom_headers,
    payload_template: pharmacy.api_payload_template,
  };

  return new PharmacyApiClient(config);
}
