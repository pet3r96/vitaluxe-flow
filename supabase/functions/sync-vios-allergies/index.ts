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

    // Get VIOS API credentials from pharmacy_api_credentials
    const { data: credentials, error: credError } = await supabaseAdmin.rpc('decrypt_pharmacy_credentials_batch', {
      p_pharmacy_id: null // Get default VIOS credentials
    });

    // Alternatively, get from environment or a specific pharmacy
    const viosApiKey = Deno.env.get("VIOS_API_KEY");
    const viosApiUrl = Deno.env.get("VIOS_API_URL") || "https://api.viosrx.com";

    if (!viosApiKey) {
      edgeLogger.error("VIOS API key not configured");
      return new Response(
        JSON.stringify({ error: "VIOS API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call VIOS API to get allergies list
    const response = await fetch(`${viosApiUrl}/Allergies`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${viosApiKey}`,
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
