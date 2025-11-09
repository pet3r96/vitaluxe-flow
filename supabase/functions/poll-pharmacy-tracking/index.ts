import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting pharmacy tracking poll...");

    // Fetch all pharmacies with API enabled and webhook URL configured
    const { data: pharmacies, error: pharmaciesError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("api_enabled", true)
      .not("webhook_url", "is", null);

    if (pharmaciesError) {
      throw new Error(`Failed to fetch pharmacies: ${pharmaciesError.message}`);
    }

    if (!pharmacies || pharmacies.length === 0) {
      console.log("No pharmacies with API/webhook configured");
      return new Response(
        JSON.stringify({ success: true, message: "No pharmacies to poll" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results: any[] = [];

    // Poll each pharmacy
    for (const pharmacy of pharmacies) {
      try {
        console.log(`Polling pharmacy: ${pharmacy.name} (${pharmacy.id})`);

        // Fetch active orders for this pharmacy
        const { data: orderLines } = await supabaseAdmin
          .from("order_lines")
          .select("id, order_id, orders!inner(order_number)")
          .eq("assigned_pharmacy_id", pharmacy.id)
          .in("status", ["processing", "shipped"])
          .limit(100);

        if (!orderLines || orderLines.length === 0) {
          console.log(`No active orders for pharmacy ${pharmacy.name}`);
          results.push({
            pharmacy_id: pharmacy.id,
            pharmacy_name: pharmacy.name,
            success: true,
            orders_polled: 0,
          });
          continue;
        }

        // Fetch API credentials
        const { data: credentials } = await supabaseAdmin
          .from("pharmacy_api_credentials")
          .select("*")
          .eq("pharmacy_id", pharmacy.id);

        // Build auth headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (pharmacy.api_auth_type === "bearer" && credentials?.length) {
          const token = credentials.find(c => c.credential_type === "bearer_token")?.credential_key;
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } else if (pharmacy.api_auth_type === "api_key" && credentials?.length) {
          const apiKey = credentials.find(c => c.credential_type === "api_key")?.credential_key;
          const keyName = pharmacy.api_auth_key_name || "X-API-Key";
          if (apiKey) headers[keyName] = apiKey;
        } else if (pharmacy.api_auth_type === "basic" && credentials?.length) {
          const username = credentials.find(c => c.credential_type === "basic_auth_username")?.credential_key;
          const password = credentials.find(c => c.credential_type === "basic_auth_password")?.credential_key;
          if (username && password) {
            headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
          }
        }

        // Calculate "since" timestamp (last 24 hours)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Call pharmacy webhook URL
        const timeout = (pharmacy.api_timeout_seconds || 30) * 1000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const webhookUrl = `${pharmacy.webhook_url}?since=${since}&limit=100`;
        const response = await fetch(webhookUrl, {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const orders = data.orders || [];

        console.log(`Received ${orders.length} tracking updates from ${pharmacy.name}`);

        // Process each tracking update
        for (const update of orders) {
          const orderLine = orderLines.find(
            ol => ol.orders?.order_number === update.vitaluxe_order_number
          );

          if (!orderLine) continue;

          // Insert tracking update
          await supabaseAdmin.from("pharmacy_tracking_updates").insert({
            order_line_id: orderLine.id,
            pharmacy_id: pharmacy.id,
            tracking_number: update.tracking_number || null,
            carrier: update.carrier || null,
            status: update.status,
            status_details: update.status_details || null,
            location: update.location || null,
            estimated_delivery_date: update.estimated_delivery || null,
            actual_delivery_date: update.actual_delivery || null,
            raw_tracking_data: update,
          });

          // Update order line if needed
          if (update.tracking_number) {
            await supabaseAdmin
              .from("order_lines")
              .update({
                tracking_number: update.tracking_number,
                carrier: update.carrier || null,
                status: update.status === "delivered" ? "delivered" : 
                        update.status === "in_transit" ? "shipped" : undefined,
                delivered_at: update.status === "delivered" ? new Date().toISOString() : undefined,
              })
              .eq("id", orderLine.id);
          }
        }

        results.push({
          pharmacy_id: pharmacy.id,
          pharmacy_name: pharmacy.name,
          success: true,
          orders_polled: orderLines.length,
          updates_received: orders.length,
        });

      } catch (error) {
        console.error(`Error polling pharmacy ${pharmacy.name}:`, error);
        results.push({
          pharmacy_id: pharmacy.id,
          pharmacy_name: pharmacy.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log("Pharmacy tracking poll complete");

    return new Response(
      JSON.stringify({ 
        success: true, 
        pharmacies_polled: pharmacies.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in poll-pharmacy-tracking:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
