import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOrderRequest {
  order_id: string;
  order_line_ids: string[]; // Now accepts array of order line IDs
  pharmacy_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const { order_id, order_line_ids, pharmacy_id }: SendOrderRequest = await req.json();

    console.log(`Sending order ${order_id} with ${order_line_ids.length} line(s) to pharmacy ${pharmacy_id}`);

    // Fetch pharmacy API configuration
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy) {
      throw new Error(`Pharmacy not found: ${pharmacyError?.message}`);
    }

    if (!pharmacy.api_enabled) {
      console.log(`Pharmacy ${pharmacy_id} does not have API enabled - skipping transmission`);
      return new Response(
        JSON.stringify({ success: true, message: "Pharmacy API not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Fetch order data with practice info
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        *, 
        profiles!orders_doctor_id_fkey(
          name, 
          email,
          address,
          address_formatted,
          shipping_address_formatted
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Fetch all order lines data with provider credentials
    const { data: orderLines, error: linesError } = await supabaseAdmin
      .from("order_lines")
      .select(`
        *,
        products(name),
        providers!order_lines_provider_id_fkey(
          user_id,
          profiles!providers_user_id_fkey(
            name,
            npi,
            dea,
            address,
            address_formatted
          )
        )
      `)
      .in("id", order_line_ids);

    if (linesError || !orderLines || orderLines.length === 0) {
      throw new Error(`Order lines not found: ${linesError?.message}`);
    }

    // Filter out lines already sent to pharmacy
    const unsent_lines = orderLines.filter(line => !line.pharmacy_order_id);
    
    if (unsent_lines.length === 0) {
      console.log(`All order lines already sent to pharmacy`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All order lines already sent to pharmacy"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    console.log(`Processing ${unsent_lines.length} unsent order line(s)`);

    // Fetch API credentials
    const { data: credentials } = await supabaseAdmin
      .from("pharmacy_api_credentials")
      .select("*")
      .eq("pharmacy_id", pharmacy_id);

    // Build payload with all order lines
    const payload = {
      order_id: order.id,
      vitaluxe_order_number: order.order_number,
      created_at: order.created_at,
      
      // Array of order lines for batching
      order_lines: unsent_lines.map(line => {
        const shipToPractice = line.ship_to === "practice";
        const shippingAddress = shipToPractice 
          ? (order.profiles?.shipping_address_formatted || order.profiles?.address_formatted || order.profiles?.address || "[PRACTICE ADDRESS NOT SET]")
          : (line.shipping_address || line.patient_address || "[ENCRYPTED]");

        return {
          order_line_id: line.id,
          patient_name: line.patient_name,
          patient_address: line.patient_address || "[ENCRYPTED]",
          patient_phone: line.patient_phone || "[ENCRYPTED]",
          patient_email: line.patient_email || "[ENCRYPTED]",
          ship_to: line.ship_to || "patient",
          shipping_address: shippingAddress,
          product: {
            name: line.products?.name || "Unknown",
            quantity: line.quantity,
            custom_sig: line.custom_sig,
            custom_dosage: line.custom_dosage,
            notes: line.notes,
          },
          prescription_url: line.prescription_url || null,
          shipping_speed: line.shipping_speed,
          destination_state: line.destination_state,
          provider: {
            name: line.providers?.profiles?.name || "Unknown",
            npi: line.providers?.profiles?.npi || null,
            dea: line.providers?.profiles?.dea || null,
            address: line.providers?.profiles?.address_formatted || line.providers?.profiles?.address || null,
            practice: order.profiles?.name || "Unknown",
          },
        };
      }),
    };

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

    // Send with retry logic
    const maxRetries = pharmacy.api_retry_count || 3;
    const timeout = (pharmacy.api_timeout_seconds || 30) * 1000;
    let lastError: string = "";
    let responseStatus: number | null = null;
    let responseBody: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt + 1}/${maxRetries} to send order to ${pharmacy.api_endpoint_url}`);

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

        // Read response body once as text to avoid "Body already consumed" error
        const responseText = await response.text();
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = { text: responseText };
        }

        if (response.ok) {
          console.log(`Successfully sent batched order to pharmacy (attempt ${attempt + 1})`);
          
          // Extract pharmacy order ID from response (could be single or array)
          const pharmacyOrderId =
            responseBody?.order_id ||
            responseBody?.pharmacy_order_id ||
            responseBody?.id ||
            responseBody?.data?.order_id ||
            responseBody?.data?.id;
          
          // Update all order_lines with pharmacy order ID
          if (pharmacyOrderId) {
            await supabaseAdmin
              .from("order_lines")
              .update({
                pharmacy_order_id: String(pharmacyOrderId),
                pharmacy_order_metadata: responseBody
              })
              .in("id", unsent_lines.map(l => l.id));
            
            console.log(`Stored pharmacy order ID: ${pharmacyOrderId} for ${unsent_lines.length} order line(s)`);
          }
          
          // Log successful transmission for each line
          for (const line of unsent_lines) {
            await supabaseAdmin.from("pharmacy_order_transmissions").insert({
              order_id: order.id,
              order_line_id: line.id,
              pharmacy_id: pharmacy.id,
              transmission_type: "new_order",
              api_endpoint: pharmacy.api_endpoint_url,
              request_payload: payload,
              response_status: responseStatus,
              response_body: responseBody,
              pharmacy_order_id: pharmacyOrderId,
              success: true,
              retry_count: attempt,
            });
          }

          // Check for alerts after successful transmission
          try {
            await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-pharmacy-alerts`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
              },
              body: JSON.stringify({
                pharmacy_id: pharmacy.id,
                check_types: ['consecutive_failures']
              })
            });
          } catch (alertError) {
            console.error('Error checking alerts:', alertError);
          }

          return new Response(
            JSON.stringify({ success: true, response: responseBody }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
          );
        }

        lastError = `HTTP ${responseStatus}: ${JSON.stringify(responseBody)}`;

        // Don't retry 4xx errors (client errors)
        if (responseStatus >= 400 && responseStatus < 500) {
          break;
        }

        // Exponential backoff for retries
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.error(`Attempt ${attempt + 1} failed:`, lastError);

        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed - log failure for each line
    for (const line of unsent_lines) {
      await supabaseAdmin.from("pharmacy_order_transmissions").insert({
        order_id: order.id,
        order_line_id: line.id,
        pharmacy_id: pharmacy.id,
        transmission_type: "new_order",
        api_endpoint: pharmacy.api_endpoint_url,
        request_payload: payload,
        response_status: responseStatus,
        response_body: responseBody,
        pharmacy_order_id: null,
        success: false,
        error_message: lastError,
        retry_count: maxRetries,
      });
    }

    // Check for alerts after failures
    try {
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-pharmacy-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          pharmacy_id: pharmacy.id,
          check_types: ['consecutive_failures', 'high_failure_rate']
        })
      });
    } catch (alertError) {
      console.error('Error checking alerts:', alertError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed after ${maxRetries} attempts: ${lastError}` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );

  } catch (error) {
    console.error("Error in send-order-to-pharmacy:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
