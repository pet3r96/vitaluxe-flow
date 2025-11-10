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
      // Direct credentials provided (for testing)
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

      baremedsCreds = JSON.parse(credData.credential_key);
    } else {
      throw new Error("Either pharmacy_id or credentials must be provided");
    }

    console.log(`Authenticating with BareMeds for site_id: ${baremedsCreds.site_id}`);

    // Call BareMeds login endpoint
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
      console.error(`BareMeds login failed: ${loginResponse.status} - ${errorText}`);
      throw new Error(`BareMeds login failed: ${loginResponse.status} - ${errorText}`);
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
