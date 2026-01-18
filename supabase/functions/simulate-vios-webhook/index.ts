import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VIOS_PHARMACY_ID = "d5e75179-e66c-450f-8cae-1f4df93b097c";

interface SimulateRequest {
  referenceId?: string;
  rxStatus: string;
  trackingNumber?: string;
  carrier?: string;
  rxNumber?: string;
  orderId?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify user is admin
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claims?.claims?.sub) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", claims.claims.sub);
    
    const isAdmin = userRoles?.some(r => ["admin", "super_admin"].includes(r.role));
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get request body
    const body: SimulateRequest = await req.json();
    const { referenceId, rxStatus, trackingNumber, carrier, rxNumber, orderId } = body;

    if (!rxStatus) {
      return new Response(
        JSON.stringify({ error: "rxStatus is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get VIOS pharmacy webhook config
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("inbound_webhook_path, webhook_secret")
      .eq("id", VIOS_PHARMACY_ID)
      .single();

    if (pharmacyError || !pharmacy) {
      return new Response(
        JSON.stringify({ error: "VIOS pharmacy not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build VIOS-format payload (single item array as VIOS sends)
    const viosPayload = [
      {
        referenceId: referenceId || `TEST-${Date.now()}`,
        orderId: orderId || Math.floor(Math.random() * 1000000),
        rxNumber: rxNumber || `TEST-RX-${Date.now()}`,
        rxStatus: rxStatus,
        rxStatusDateTime: new Date().toISOString(),
        trackingNumber: trackingNumber || (rxStatus === "Shipping" ? `TEST-TRACK-${Date.now()}` : undefined),
        shipCarrier: carrier || (rxStatus === "Shipping" ? "UPS" : undefined),
        shipCity: rxStatus === "Shipping" || rxStatus === "Delivered" ? "Test City" : undefined,
        shipState: rxStatus === "Shipping" || rxStatus === "Delivered" ? "CA" : undefined,
        fillId: Math.floor(Math.random() * 100000),
        // Mark as simulated for debugging
        _simulated: true,
        _simulatedAt: new Date().toISOString(),
        _simulatedBy: claims.claims.sub,
      },
    ];

    console.log("[Webhook Simulator] Sending payload:", JSON.stringify(viosPayload, null, 2));

    // Call the actual receive-pharmacy-webhook endpoint
    const webhookUrl = `${supabaseUrl}/functions/v1/receive-pharmacy-webhook/${pharmacy.inbound_webhook_path}`;
    
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": pharmacy.webhook_secret || "",
      },
      body: JSON.stringify(viosPayload),
    });

    const webhookResult = await webhookResponse.json();

    console.log("[Webhook Simulator] Response:", webhookResponse.status, JSON.stringify(webhookResult));

    return new Response(
      JSON.stringify({
        success: webhookResponse.ok,
        httpStatus: webhookResponse.status,
        webhookResponse: webhookResult,
        sentPayload: viosPayload[0],
        webhookUrl: webhookUrl.replace(pharmacy.inbound_webhook_path, "[REDACTED]"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[Webhook Simulator] Error:", err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
