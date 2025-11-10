import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TokenRequest {
  pharmacy_id?: string;
  credentials?: {
    email: string;
    password: string;
    site_id: number;
    base_url: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { pharmacy_id, credentials }: TokenRequest = await req.json();

    let baremedsCreds: any;

    if (credentials) {
      // Direct credentials provided (for testing) - but validate they're complete
      if (!credentials.email || !credentials.password || !credentials.site_id || !credentials.base_url) {
        console.error("Incomplete credentials provided:", { 
          hasEmail: !!credentials.email,
          hasPassword: !!credentials.password, 
          hasSiteId: !!credentials.site_id,
          hasBaseUrl: !!credentials.base_url
        });
        throw new Error("Incomplete credentials: missing email, password, site_id, or base_url");
      }
      baremedsCreds = credentials;
    } else if (pharmacy_id) {
      // Fetch credentials from database
      const { data: credData, error: credError } = await supabaseAdmin
        .from("pharmacy_api_credentials")
        .select("credential_key")
        .eq("pharmacy_id", pharmacy_id)
        .eq("credential_type", "baremeds_oauth")
        .single();

      if (credError || !credData) {
        throw new Error(`BareMeds credentials not found for pharmacy ${pharmacy_id}`);
      }

      console.log(`Raw credential_key length: ${credData.credential_key?.length || 0}`);

      // Parse credential_key - handle double-encoding
      let parsed: any;
      try {
        parsed = JSON.parse(credData.credential_key);
        // Check if it's double-encoded (string instead of object)
        if (typeof parsed === 'string') {
          console.log("Detected double-encoded credential_key, parsing again");
          parsed = JSON.parse(parsed);
        }
      } catch (e) {
        console.error("Failed to parse credential_key:", e);
        throw new Error("Invalid credential_key format in database");
      }

      // Normalize key names (handle variations like baseUrl vs base_url)
      baremedsCreds = {
        email: parsed.email || parsed.Email,
        password: parsed.password || parsed.Password,
        site_id: parsed.site_id || parsed.siteId || parsed.site,
        base_url: parsed.base_url || parsed.baseUrl || parsed.url || parsed.base,
      };

      // Validate all required fields are present
      const missing = [];
      if (!baremedsCreds.email) missing.push('email');
      if (!baremedsCreds.password) missing.push('password');
      if (!baremedsCreds.site_id) missing.push('site_id');
      if (!baremedsCreds.base_url) missing.push('base_url');

      if (missing.length > 0) {
        console.error("Missing required fields after normalization:", missing);
        console.error("Parsed object keys:", Object.keys(parsed));
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Missing required BareMeds configuration: ${missing.join(', ')}. Please update pharmacy API configuration.`,
            missing_fields: missing
          }),
          { 
            headers: { ...corsHeaders, "Content-Type": "application/json" }, 
            status: 400 
          }
        );
      }

      console.log(`Resolved credentials - base_url origin: ${new URL(baremedsCreds.base_url).origin}, site_id: ${baremedsCreds.site_id}`);
    } else {
      throw new Error("Either pharmacy_id or credentials must be provided");
    }

    console.log(`Authenticating with BareMeds for site_id: ${baremedsCreds.site_id}`);

    // Build login URL safely
    let loginUrl: string;
    try {
      loginUrl = new URL('/api/auth/login', baremedsCreds.base_url).toString();
      console.log(`Constructed login URL: ${loginUrl}`);
    } catch (e) {
      console.error("Invalid base_url:", baremedsCreds.base_url, e);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Invalid BareMeds base_url: ${baremedsCreds.base_url}` 
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: 400 
        }
      );
    }

    const loginPayload = {
      email: baremedsCreds.email,
      password: baremedsCreds.password,
      site_id: baremedsCreds.site_id,
    };

    const loginResponse = await fetch(loginUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(loginPayload),
    });

    // If BareMeds returns an error status, surface the text body for debugging
    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error(`BareMeds login failed: ${loginResponse.status} - ${errorText}`);
      throw new Error(`BareMeds login failed: ${loginResponse.status} - ${loginResponse.statusText}. Body: ${errorText.slice(0, 500)}`);
    }

    // Guard against non-JSON (e.g., HTML error pages)
    const contentType = (loginResponse.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("application/json")) {
      const bodyText = await loginResponse.text();
      console.error(`BareMeds login returned non-JSON (${loginResponse.status}): ${bodyText.substring(0, 500)}`);
      throw new Error(`BareMeds login returned non-JSON (${loginResponse.status}). Body: ${bodyText.substring(0, 500)}`);
    }

    const loginData = await loginResponse.json();

    if (!loginData.token && !loginData.access_token) {
      console.error("BareMeds response missing token:", loginData);
      throw new Error("BareMeds authentication response missing token");
    }

    const token = loginData.token || loginData.access_token;

    console.log(`Successfully authenticated with BareMeds, token: ${token.substring(0, 10)}...`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        token,
        expires_at: loginData.expires_at,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error in baremeds-get-token:", error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" }, 
        status: 500 
      }
    );
  }
});
