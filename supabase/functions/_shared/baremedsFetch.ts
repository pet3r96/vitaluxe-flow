/**
 * Reusable helper for making authenticated BareMeds API calls
 * Automatically handles token retrieval and authorization headers
 */

export interface BaremedsFetchOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function baremedsFetch(
  supabaseAdmin: any,
  pharmacyId: string,
  endpoint: string,
  options: BaremedsFetchOptions = {}
): Promise<Response> {
  try {
    // Get BareMeds credentials
    const { data: credData, error: credError } = await supabaseAdmin
      .from("pharmacy_api_credentials")
      .select("credential_key")
      .eq("pharmacy_id", pharmacyId)
      .eq("credential_type", "baremeds_oauth")
      .single();

    if (credError || !credData) {
      throw new Error(`BareMeds credentials not found for pharmacy ${pharmacyId}`);
    }

    // Parse credentials, handling double-encoded JSON
    let baremedsCreds = JSON.parse(credData.credential_key);
    
    // Handle double-encoded credentials (stored as string)
    if (typeof baremedsCreds === 'string') {
      console.log("Detected double-encoded credentials, parsing again...");
      baremedsCreds = JSON.parse(baremedsCreds);
    }

    // Normalize field names (handle multiple naming conventions)
    const normalized = {
      baseUrl: baremedsCreds.base_url || baremedsCreds.baseUrl || baremedsCreds.url || baremedsCreds.base || baremedsCreds.api_base_url,
      email: baremedsCreds.email || baremedsCreds.Email,
      password: baremedsCreds.password || baremedsCreds.Password,
      siteId: baremedsCreds.site_id || baremedsCreds.siteId || baremedsCreds.site,
    };

    console.log("BareMeds credentials parsed:", {
      rawLength: credData.credential_key.length,
      wasDoubleEncoded: typeof JSON.parse(credData.credential_key) === 'string',
      hasBaseUrl: !!normalized.baseUrl,
      baseUrlOrigin: normalized.baseUrl ? new URL(normalized.baseUrl).origin : null,
      hasEmail: !!normalized.email,
      hasSiteId: !!normalized.siteId,
      credKeys: Object.keys(baremedsCreds).slice(0, 10) // First 10 keys only
    });

    // Validate required fields
    const missing = [];
    if (!normalized.baseUrl) missing.push('base_url');
    if (!normalized.email) missing.push('email');
    if (!normalized.password) missing.push('password');
    if (!normalized.siteId) missing.push('site_id');
    
    if (missing.length > 0) {
      throw new Error(`Missing required BareMeds credentials: ${missing.join(', ')}. Available keys: ${Object.keys(baremedsCreds).slice(0, 20).join(', ')}`);
    }

    // Get authentication token
    const loginUrl = new URL('/api/auth/login', normalized.baseUrl).toString();
    const loginPayload = {
      email: normalized.email,
      password: normalized.password,
      site_id: normalized.siteId,
    };

    const loginResponse = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(loginPayload),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      throw new Error(`BareMeds login failed: ${loginResponse.status} - ${errorText}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.token || loginData.access_token;

    if (!token) {
      throw new Error("BareMeds authentication response missing token");
    }

    // Make the actual API call with the token
    const apiUrl = new URL(endpoint, normalized.baseUrl).toString();
    console.log(`Calling BareMeds API: ${apiUrl}`);
    
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...options.headers,
    };

    const response = await fetch(apiUrl, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    return response;

  } catch (error) {
    console.error("Error in baremedsFetch:", error);
    throw error;
  }
}
