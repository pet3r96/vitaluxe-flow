/**
 * Simple HTTP client for BareMeds API calls
 * Assumes authentication token is already retrieved
 * Use baremeds-get-token function to obtain tokens
 */

export interface BaremedsFetchOptions {
  method?: string;
  headers?: Record<string, string>;
}

/**
 * Makes an authenticated HTTP request to BareMeds API
 * @param endpoint - API endpoint path (e.g., "/api/orders")
 * @param payload - Request body data
 * @param token - Bearer authentication token
 * @param options - Additional request options
 * @returns Raw Response object
 */
export async function baremedsFetch(
  endpoint: string,
  payload: unknown,
  token: string,
  options: BaremedsFetchOptions = {}
): Promise<Response> {
  // Get base URL from environment or use default staging
  const baseUrl = Deno.env.get("BAREMEDS_API_BASE_URL") || "https://staging-rxorders.baremeds.com";
  const fullUrl = `${baseUrl}${endpoint}`;
  
  console.log(`[baremedsFetch] 📤 Sending request`, {
    endpoint,
    method: options.method || "POST",
    baseUrl,
    payloadSize: JSON.stringify(payload).length,
    hasToken: !!token,
  });

  try {
    const response = await fetch(fullUrl, {
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      body: JSON.stringify(payload),
    });

    // Clone response to log it without consuming the stream
    const responseClone = response.clone();
    const responseText = await responseClone.text();
    
    console.log(`[baremedsFetch] 📥 Response received`, {
      status: response.status,
      ok: response.ok,
      contentType: response.headers.get("content-type"),
      bodyPreview: responseText.substring(0, 500),
      bodySize: responseText.length,
    });

    return response;

  } catch (error) {
    console.error(`[baremedsFetch] ❌ Fetch error:`, error);
    throw error;
  }
}
