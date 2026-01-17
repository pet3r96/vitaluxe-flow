import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ViosAllergyItem {
  Code: number;
  Description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    // Verify the caller is an admin (optional - can be removed for scheduled calls)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !user) {
        edgeLogger.warn("Unauthorized sync attempt");
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user is admin
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || !["admin", "super_admin"].includes(profile.role)) {
        edgeLogger.warn("Non-admin sync attempt", { userId: user.id, role: profile?.role });
        return new Response(
          JSON.stringify({ error: "Admin access required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    edgeLogger.info("Starting VIOS allergies sync");

    // Get VIOS credentials from environment
    const viosClientId = Deno.env.get("VIOS_CLIENT_ID");
    const viosClientSecret = Deno.env.get("VIOS_CLIENT_SECRET");
    const viosApiUrl = "https://integrations.vioscompounding.com";

    if (!viosClientId || !viosClientSecret) {
      edgeLogger.error("VIOS credentials not configured");
      return new Response(
        JSON.stringify({ error: "VIOS credentials not configured (VIOS_CLIENT_ID and VIOS_CLIENT_SECRET required)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth token using client credentials
    edgeLogger.info("Obtaining VIOS OAuth token");
    const tokenResponse = await fetch(`${viosApiUrl}/Token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: viosClientId,
        client_secret: viosClientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const tokenError = await tokenResponse.text();
      edgeLogger.error("VIOS token request failed", { status: tokenResponse.status, error: tokenError });
      return new Response(
        JSON.stringify({ error: `VIOS authentication failed: ${tokenResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      edgeLogger.error("No access token in VIOS response", { tokenData });
      return new Response(
        JSON.stringify({ error: "Failed to obtain VIOS access token" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    edgeLogger.info("VIOS OAuth token obtained successfully");

    // Call VIOS API to get allergies list
    const response = await fetch(`${viosApiUrl}/api/Allergies`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      edgeLogger.error("VIOS API error", { status: response.status, error: errorText });
      return new Response(
        JSON.stringify({ error: `VIOS API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allergies: ViosAllergyItem[] = await response.json();
    edgeLogger.info("Fetched allergies from VIOS", { count: allergies.length });

    // Upsert allergies into vios_allergies table
    let upsertCount = 0;
    let errorCount = 0;

    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < allergies.length; i += batchSize) {
      const batch = allergies.slice(i, i + batchSize).map(item => ({
        vios_code: item.Code,
        name: item.Description,
        is_active: true,
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await supabaseAdmin
        .from("vios_allergies")
        .upsert(batch, { 
          onConflict: "vios_code",
          ignoreDuplicates: false 
        });

      if (upsertError) {
        edgeLogger.error("Upsert batch error", { batch: i, error: upsertError.message });
        errorCount += batch.length;
      } else {
        upsertCount += batch.length;
      }
    }

    edgeLogger.info("VIOS allergies sync complete", { upsertCount, errorCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Synced ${upsertCount} allergies from VIOS`,
        totalFetched: allergies.length,
        upsertCount,
        errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    edgeLogger.error("Sync VIOS allergies error", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
