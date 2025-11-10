import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CancelOrderRequest {
  order_id: string;
  pharmacy_id: string;
  cancellation_reason?: string;
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

    const { order_id, pharmacy_id, cancellation_reason }: CancelOrderRequest = await req.json();

    console.log(`Sending cancellation for order ${order_id} to pharmacy ${pharmacy_id}`);

    // Check if this order was previously transmitted to the pharmacy
    const { data: transmission } = await supabaseAdmin
      .from("pharmacy_order_transmissions")
      .select("*")
      .eq("order_id", order_id)
      .eq("pharmacy_id", pharmacy_id)
      .eq("transmission_type", "new_order")
      .eq("success", true)
      .order("transmitted_at", { ascending: false })
      .limit(1)
      .single();

    if (!transmission) {
      console.log(`No successful transmission found for order ${order_id} - skipping cancellation notification`);
      return new Response(
        JSON.stringify({ success: true, message: "Order was not transmitted to pharmacy" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch pharmacy API configuration
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy || !pharmacy.api_enabled) {
      console.log(`Pharmacy ${pharmacy_id} does not have API enabled`);
      return new Response(
        JSON.stringify({ success: true, message: "Pharmacy API not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch order data
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("order_number")
      .eq("id", order_id)
      .single();

    // Build cancellation payload
    const payload = {
      order_id: order_id,
      order_line_id: transmission.order_line_id,
      vitaluxe_order_number: order?.order_number,
      cancellation_reason: cancellation_reason || "Customer request",
      cancelled_at: new Date().toISOString(),
    };

    // Fetch API credentials
    const { data: credentials } = await supabaseAdmin
      .from("pharmacy_api_credentials")
      .select("*")
      .eq("pharmacy_id", pharmacy_id);

    // Build auth headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Handle BareMeds OAuth using standardized token flow
    if (pharmacy.api_auth_type === "baremeds") {
      console.log('[send-cancellation] Getting BareMeds token...');
      try {
        const tokenResponse = await supabaseAdmin.functions.invoke('baremeds-get-token', {
          body: { pharmacy_id: pharmacy_id }
        });

        if (tokenResponse.error || !tokenResponse.data?.token) {
          throw new Error(`Token retrieval failed: ${tokenResponse.error?.message || 'No token returned'}`);
        }

        headers["Authorization"] = `Bearer ${tokenResponse.data.token}`;
        console.log('[send-cancellation] ✅ Token retrieved successfully');
      } catch (error: any) {
        console.error('[send-cancellation] ❌ Token error:', error);
        return new Response(
          JSON.stringify({ success: false, error: `BareMeds auth failed: ${error.message}` }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } else if (pharmacy.api_auth_type === "bearer" && credentials?.length) {
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

    // Send cancellation (with retry)
    const maxRetries = 2; // Fewer retries for cancellations
    const timeout = (pharmacy.api_timeout_seconds || 30) * 1000;
    let lastError: string = "";
    let responseStatus: number | null = null;
    let responseBody: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(pharmacy.api_endpoint_url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        responseStatus = response.status;

        try {
          responseBody = await response.json();
        } catch {
          responseBody = { text: await response.text() };
        }

        if (response.ok) {
          await supabaseAdmin.from("pharmacy_order_transmissions").insert({
            order_id: order_id,
            order_line_id: transmission.order_line_id,
            pharmacy_id: pharmacy.id,
            transmission_type: "cancellation",
            api_endpoint: pharmacy.api_endpoint_url,
            request_payload: payload,
            response_status: responseStatus,
            response_body: responseBody,
            success: true,
            retry_count: attempt,
          });

          return new Response(
            JSON.stringify({ success: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        lastError = `HTTP ${responseStatus}: ${JSON.stringify(responseBody)}`;

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`Cancellation attempt ${attempt + 1} failed:`, lastError);
      }
    }

    // Log failure
    await supabaseAdmin.from("pharmacy_order_transmissions").insert({
      order_id: order_id,
      order_line_id: transmission.order_line_id,
      pharmacy_id: pharmacy.id,
      transmission_type: "cancellation",
      api_endpoint: pharmacy.api_endpoint_url,
      request_payload: payload,
      response_status: responseStatus,
      response_body: responseBody,
      success: false,
      error_message: lastError,
      retry_count: maxRetries,
    });

    return new Response(
      JSON.stringify({ success: false, error: lastError }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );

  } catch (error) {
    console.error("Error in send-cancellation-to-pharmacy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
