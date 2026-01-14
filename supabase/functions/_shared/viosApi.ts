import { edgeLogger } from './logger.ts';
import { 
  ViosErrorType, 
  ViosError, 
  ViosTokenResponse,
  ViosEnvironment,
  type ViosConfig 
} from './viosTypes.ts';

/**
 * Shared VIOS API utilities for authentication, credentials, and error handling
 * 
 * ARCHITECTURE NOTES:
 * - This is the SINGLE source of truth for VIOS authentication
 * - All VIOS edge functions must use these utilities
 * - Never duplicate token logic elsewhere
 */

export interface ViosCredentials {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  environment: ViosEnvironment;
}

export interface ViosApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: ViosErrorType;
  statusCode?: number;
}

/**
 * Validate and sanitize credential string
 * Catches common issues: whitespace, empty values, placeholder text
 */
function validateCredential(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`VIOS ${name} is not configured`);
  }
  
  const trimmed = value.trim();
  
  if (trimmed !== value) {
    edgeLogger.warn(`VIOS: ${name} had leading/trailing whitespace (removed)`);
  }
  
  if (trimmed.length === 0) {
    throw new Error(`VIOS ${name} is empty after trimming whitespace`);
  }
  
  // Check for common placeholder values
  const placeholders = ['your-client-id', 'your-client-secret', 'xxx', 'placeholder', '<'];
  if (placeholders.some(p => trimmed.toLowerCase().includes(p))) {
    throw new Error(`VIOS ${name} appears to contain placeholder text`);
  }
  
  // Minimum length check (VIOS credentials are typically 32+ chars)
  if (trimmed.length < 10) {
    edgeLogger.warn(`VIOS: ${name} seems unusually short (${trimmed.length} chars)`);
  }
  
  return trimmed;
}

/**
 * Determine environment from base URL
 */
function detectEnvironment(baseUrl: string): ViosEnvironment {
  if (baseUrl.includes('sandbox') || baseUrl.includes('test') || baseUrl.includes('staging')) {
    return 'sandbox';
  }
  return 'production';
}

// Cache for VIOS tokens (in-memory, per-execution)
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Get VIOS credentials from environment variables or database
 * Includes validation and environment detection
 */
export async function getViosCredentials(
  supabaseAdmin: any,
  pharmacyId: string
): Promise<ViosCredentials | null> {
  // Check environment variables first (priority)
  const envClientId = Deno.env.get('VIOS_CLIENT_ID');
  const envClientSecret = Deno.env.get('VIOS_CLIENT_SECRET');
  
  // Get pharmacy config for base URL
  const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
    .from('pharmacies')
    .select('api_endpoint_url, api_handler_type')
    .eq('id', pharmacyId)
    .single();
  
  if (pharmacyError || !pharmacy) {
    edgeLogger.error('VIOS: Failed to fetch pharmacy config', { pharmacyId, error: pharmacyError?.message });
    return null;
  }
  
  if (pharmacy.api_handler_type !== 'vios') {
    edgeLogger.warn('VIOS: Pharmacy is not configured for VIOS API', { pharmacyId, handlerType: pharmacy.api_handler_type });
    return null;
  }
  
  const baseUrl = pharmacy.api_endpoint_url?.replace(/\/+$/, '') || 'https://integrations.vioscompounding.com';
  const environment = detectEnvironment(baseUrl);
  
  edgeLogger.info('VIOS: Environment detected', { environment, baseUrl });
  
  // Use env vars if both are set
  if (envClientId && envClientSecret) {
    try {
      const validatedClientId = validateCredential(envClientId, 'CLIENT_ID');
      const validatedClientSecret = validateCredential(envClientSecret, 'CLIENT_SECRET');
      
      return { 
        clientId: validatedClientId, 
        clientSecret: validatedClientSecret, 
        baseUrl,
        environment
      };
    } catch (error) {
      edgeLogger.error('VIOS: Environment credential validation failed', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Fall through to database credentials
    }
  }
  
  // Fallback to database credentials
  const { data: credentials, error: credError } = await supabaseAdmin.rpc(
    'decrypt_pharmacy_credentials_batch',
    { p_pharmacy_id: pharmacyId }
  );
  
  if (credError || !credentials || credentials.length === 0) {
    edgeLogger.error('VIOS: Failed to fetch credentials from database', { pharmacyId, error: credError?.message });
    return null;
  }
  
  const dbClientId = credentials.find((c: any) => c.credential_type === 'vios_client_key')?.credential_key;
  const dbClientSecret = credentials.find((c: any) => c.credential_type === 'vios_client_secret')?.credential_key;
  
  if (!dbClientId || !dbClientSecret) {
    edgeLogger.error('VIOS: Missing credentials in database', { pharmacyId });
    return null;
  }
  
  try {
    const validatedClientId = validateCredential(dbClientId, 'CLIENT_ID (database)');
    const validatedClientSecret = validateCredential(dbClientSecret, 'CLIENT_SECRET (database)');
    
    return { 
      clientId: validatedClientId, 
      clientSecret: validatedClientSecret, 
      baseUrl,
      environment
    };
  } catch (error) {
    edgeLogger.error('VIOS: Database credential validation failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return null;
  }
}

/**
 * Get VIOS JWT token with caching
 */
export async function getViosToken(credentials: ViosCredentials): Promise<string> {
  const cacheKey = `${credentials.baseUrl}:${credentials.clientId}`;
  const cached = tokenCache.get(cacheKey);
  
  // Return cached token if still valid (with 5 minute buffer)
  if (cached && cached.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cached.token;
  }
  
  const tokenUrl = `${credentials.baseUrl}/api/auth/token`;
  const startTime = Date.now();
  
  edgeLogger.info('VIOS: Fetching JWT token', { tokenUrl });
  
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'ClientId': credentials.clientId,
      'ClientSecret': credentials.clientSecret
    }
  });
  
  const duration = Date.now() - startTime;
  
  if (!response.ok) {
    const errorText = await response.text();
    edgeLogger.error('VIOS: Token request failed', { status: response.status, duration, error: errorText.substring(0, 500) });
    throw new Error(`VIOS auth failed (${response.status}): ${errorText}`);
  }
  
  const data = await response.json();
  if (!data.accessToken) {
    edgeLogger.error('VIOS: Token response missing accessToken', { responseKeys: Object.keys(data) });
    throw new Error('VIOS auth response missing accessToken');
  }
  
  // Cache token for 14 minutes (VIOS tokens expire in 15 mins per their FAQ)
  tokenCache.set(cacheKey, {
    token: data.accessToken,
    expiresAt: Date.now() + 14 * 60 * 1000
  });
  
  edgeLogger.info('VIOS: JWT token obtained', { duration, tokenLength: data.accessToken.length });
  return data.accessToken;
}

/**
 * Make authenticated VIOS API request
 */
export async function viosRequest<T>(
  credentials: ViosCredentials,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any,
  queryParams?: Record<string, string>
): Promise<ViosApiResult<T>> {
  const startTime = Date.now();
  
  try {
    const token = await getViosToken(credentials);
    
    let url = `${credentials.baseUrl}${endpoint}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      url += `?${params.toString()}`;
    }
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    edgeLogger.info(`VIOS: ${method} ${endpoint}`, { url, hasBody: !!body });
    
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    let responseData: any;
    const responseText = await response.text();
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { text: responseText };
    }
    
    if (!response.ok) {
      // Extract actionable error message from VIOS response
      let errorMessage = `VIOS API error (${response.status})`;
      
      // VIOS returns errors in multiple nested formats - extract all possible error text
      const rawErrorText = responseData?.text || 
                           responseData?.message || 
                           responseData?.Message ||
                           (typeof responseData === 'string' ? responseData : null) ||
                           responseText.substring(0, 500);
      
      if (response.status === 400) {
        // Validation error - check for VIOS-specific error patterns first
        if (rawErrorText?.includes('API Network ID different') || rawErrorText?.includes('practice')) {
          errorMessage = `NPI Registration Error: The prescriber NPI is not associated with your VIOS account's practice. The NPI may be registered under a different VIOS network. Please verify the NPI is correctly configured in your VIOS account, or contact VIOS support.`;
        } else if (rawErrorText?.includes('product') || rawErrorText?.includes('lfProductId')) {
          errorMessage = `Product Error: ${rawErrorText}. The lfProductId may not be valid for your account.`;
        } else {
          // Extract field-level errors
          const errors = responseData?.errors || responseData?.Errors || [];
          if (Array.isArray(errors) && errors.length > 0) {
            errorMessage = `Validation failed: ${errors.map((e: any) => e.message || e.Message || e).join('; ')}`;
          } else if (rawErrorText) {
            errorMessage = `Validation failed: ${rawErrorText}`;
          }
        }
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Check VIOS credentials and ensure they are not expired.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. The VIOS account may not have permission for this operation.';
      } else if (response.status === 404) {
        errorMessage = 'Resource not found in VIOS. The order or entity may not exist.';
      } else if (response.status === 422) {
        errorMessage = `Schema error: ${responseData?.message || responseData?.Message || 'Invalid data format'}`;
      } else if (response.status >= 500) {
        errorMessage = 'VIOS server error. Please try again later or contact VIOS support.';
      }
      
      edgeLogger.error(`VIOS: ${method} ${endpoint} failed`, { 
        status: response.status, 
        duration, 
        error: responseData,
        parsedError: errorMessage
      });
      
      return {
        success: false,
        error: errorMessage,
        statusCode: response.status,
        data: responseData // Include raw response for debugging
      };
    }
    
    edgeLogger.info(`VIOS: ${method} ${endpoint} success`, { duration, status: response.status });
    return { success: true, data: responseData, statusCode: response.status };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error(`VIOS: ${method} ${endpoint} exception`, { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

/**
 * Log VIOS API transmission to database
 */
export async function logViosTransmission(
  supabaseAdmin: any,
  params: {
    orderId: string;
    orderLineId?: string;
    pharmacyId: string;
    transmissionType: string;
    apiEndpoint: string;
    requestPayload: any;
    responseStatus: number;
    responseBody: any;
    pharmacyOrderId?: string;
    success: boolean;
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await supabaseAdmin.from('pharmacy_order_transmissions').insert({
      order_id: params.orderId,
      order_line_id: params.orderLineId || null,
      pharmacy_id: params.pharmacyId,
      transmission_type: params.transmissionType,
      api_endpoint: params.apiEndpoint,
      request_payload: params.requestPayload,
      response_status: params.responseStatus,
      response_body: params.responseBody,
      pharmacy_order_id: params.pharmacyOrderId || null,
      success: params.success,
      error_message: params.errorMessage || null,
      retry_count: 0,
    });
  } catch (error) {
    edgeLogger.error('Failed to log VIOS transmission', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Check if pharmacy is VIOS-enabled and has API enabled
 */
export async function isViosPharmacy(supabaseAdmin: any, pharmacyId: string): Promise<boolean> {
  const { data: pharmacy, error } = await supabaseAdmin
    .from('pharmacies')
    .select('api_enabled, api_handler_type')
    .eq('id', pharmacyId)
    .single();
  
  if (error || !pharmacy) return false;
  return pharmacy.api_enabled && pharmacy.api_handler_type === 'vios';
}

/**
 * Get pharmacy order ID from order line
 */
export async function getPharmacyOrderId(
  supabaseAdmin: any,
  orderLineId: string
): Promise<{ pharmacyOrderId: string | null; pharmacyId: string | null; orderId: string | null }> {
  const { data: orderLine, error } = await supabaseAdmin
    .from('order_lines')
    .select('pharmacy_order_id, assigned_pharmacy_id, order_id')
    .eq('id', orderLineId)
    .single();
  
  if (error || !orderLine) {
    return { pharmacyOrderId: null, pharmacyId: null, orderId: null };
  }
  
  return {
    pharmacyOrderId: orderLine.pharmacy_order_id,
    pharmacyId: orderLine.assigned_pharmacy_id,
    orderId: orderLine.order_id
  };
}

/**
 * Format phone number to VIOS format: (XXX) XXX-XXXX
 */
export function formatPhoneForVios(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

/**
 * Format date to VIOS format: yyyy-MM-dd
 */
export function formatDateForVios(date: string | Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}
