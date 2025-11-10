/**
 * Simple HTTP client for BareMeds API calls
 * Assumes authentication token is already retrieved
 * Use baremeds-get-token function to obtain tokens
 */

import { sanitizeBaremedsResponse } from "./baremedsUtils.ts";

export interface BaremedsFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  dryRun?: boolean; // If true, logs the request but doesn't send it
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
  
  console.log(`[baremedsFetch] 📤 Request prepared`, {
    endpoint,
    method: options.method || "POST",
    baseUrl,
    fullUrl,
    payloadSize: JSON.stringify(payload).length,
    hasToken: !!token,
    dryRun: options.dryRun || false,
  });

  // DRY RUN: Log request details without sending
  if (options.dryRun) {
    console.log(`[baremedsFetch] 🧪 DRY RUN - Request NOT sent:`, {
      url: fullUrl,
      method: options.method || "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.substring(0, 20)}...`,
        ...options.headers,
      },
      payload: JSON.stringify(payload, null, 2),
    });

    // Return a mock successful response for dry run
    return new Response(
      JSON.stringify({
        success: true,
        message: "DRY RUN - Request not sent",
        would_send_to: fullUrl,
        payload_size: JSON.stringify(payload).length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

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

    // MONITORING: Log non-2xx responses for alerting
    if (!response.ok) {
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(responseText);
      } catch {
        parsedBody = { text: responseText.substring(0, 500) };
      }
      
      console.warn(`[baremedsFetch] ⚠️ Non-2xx response from BareMeds`, {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        responseBody: sanitizeBaremedsResponse(parsedBody),
        timestamp: new Date().toISOString(),
      });
      
      // Log critical errors (5xx) as errors
      if (response.status >= 500) {
        console.error(`[baremedsFetch] 🚨 BareMeds server error`, {
          endpoint,
          status: response.status,
          responseBody: sanitizeBaremedsResponse(parsedBody),
        });
      }
    }

    return response;

  } catch (error) {
    console.error(`[baremedsFetch] ❌ Fetch error:`, error);
    throw error;
  }
}
