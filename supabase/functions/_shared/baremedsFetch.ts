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

    // Get authentication token
    const loginUrl = `${baremedsCreds.base_url}/api/auth/login`;
    const loginPayload = {
      email: baremedsCreds.email,
      password: baremedsCreds.password,
      site_id: baremedsCreds.site_id,
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
    const apiUrl = `${baremedsCreds.base_url}${endpoint}`;
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
