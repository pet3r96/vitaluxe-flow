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

    const baremedsCreds = JSON.parse(credData.credential_key);

    // Normalize field names (handle base_url, baseUrl, api_base_url variations)
    const baseUrl = baremedsCreds.base_url || baremedsCreds.baseUrl || baremedsCreds.api_base_url;
    const email = baremedsCreds.email;
    const password = baremedsCreds.password;
    const siteId = baremedsCreds.site_id || baremedsCreds.siteId;

    console.log("BareMeds credentials parsed:", {
      hasBaseUrl: !!baseUrl,
      baseUrl: baseUrl,
      hasEmail: !!email,
      hasSiteId: !!siteId,
      credKeys: Object.keys(baremedsCreds)
    });

    if (!baseUrl || !email || !password || !siteId) {
      throw new Error(`Missing required BareMeds credentials. Found: ${JSON.stringify(Object.keys(baremedsCreds))}`);
    }

    // Get authentication token
    const loginUrl = `${baseUrl}/api/auth/login`;
    const loginPayload = {
      email: email,
      password: password,
      site_id: siteId,
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
    const apiUrl = `${baseUrl}${endpoint}`;
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
