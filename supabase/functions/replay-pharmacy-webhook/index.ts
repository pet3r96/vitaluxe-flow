import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Check admin role
    const { data: userRole, error: roleError } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !userRole || !['admin', 'super_admin'].includes(userRole.role)) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const { eventId } = await req.json();

    if (!eventId) {
      return new Response(
        JSON.stringify({ error: "Missing eventId" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();

    // Fetch the original webhook event
    const { data: originalEvent, error: fetchError } = await supabaseAdmin
      .from("pharmacy_webhook_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (fetchError || !originalEvent) {
      return new Response(
        JSON.stringify({ error: "Webhook event not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get pharmacy info
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("id, name, webhook_secret, api_enabled, api_status_mapping")
      .eq("id", originalEvent.pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy) {
      return new Response(
        JSON.stringify({ error: "Pharmacy not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    edgeLogger.info('Replaying webhook event', {
      originalEventId: eventId,
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name,
      adminUserId: user.id
    });

    // Use transformed payload if available, otherwise raw
    const payloadToProcess = originalEvent.transformed_payload || originalEvent.raw_payload;

    if (!payloadToProcess) {
      return new Response(
        JSON.stringify({ error: "No payload to replay" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Inline processing logic (similar to receive-pharmacy-webhook)
    const payload = Array.isArray(payloadToProcess) ? payloadToProcess[0] : payloadToProcess;
    
    // Find order line
    let orderLineId: string | null = null;
    
    if (payload.order_line_id) {
      const { data: orderLineById } = await supabaseAdmin
        .from("order_lines")
        .select("id")
        .eq("id", payload.order_line_id)
        .eq("assigned_pharmacy_id", pharmacy.id)
        .single();
      orderLineId = orderLineById?.id || null;
    }
    
    if (!orderLineId && payload.pharmacy_order_id) {
      const { data: orderLineByPharmacyId } = await supabaseAdmin
        .from("order_lines")
        .select("id")
        .eq("pharmacy_order_id", payload.pharmacy_order_id)
        .eq("assigned_pharmacy_id", pharmacy.id)
        .single();
      orderLineId = orderLineByPharmacyId?.id || null;
    }

    if (!orderLineId) {
      // Log replay failure
      await supabaseAdmin
        .from("pharmacy_webhook_events")
        .insert({
          pharmacy_id: pharmacy.id,
          webhook_path: originalEvent.webhook_path,
          request_headers: { replayed_by: user.email },
          raw_payload: originalEvent.raw_payload,
          transformed_payload: originalEvent.transformed_payload,
          order_line_id: null,
          status_code: 404,
          response_body: { error: "Order not found on replay" },
          error_message: "Order not found on replay",
          processing_time_ms: 0,
          is_duplicate: false,
          replayed_from_event_id: eventId,
        });

      return new Response(
        JSON.stringify({ error: "Order line not found for replay" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Insert tracking update (replay forces insert, skips idempotency)
    const { error: insertError } = await supabaseAdmin
      .from("pharmacy_tracking_updates")
      .insert({
        order_line_id: orderLineId,
        pharmacy_id: pharmacy.id,
        tracking_number: payload.tracking_number || null,
        carrier: payload.carrier || null,
        status: payload.status,
        status_details: payload.status_details || null,
        location: payload.location || null,
        estimated_delivery_date: payload.estimated_delivery || null,
        actual_delivery_date: payload.actual_delivery || null,
        raw_tracking_data: { ...payload, _replayed: true, _replayed_by: user.email },
      });

    if (insertError) {
      edgeLogger.error('Failed to insert tracking update on replay', insertError);
      return new Response(
        JSON.stringify({ error: "Failed to save tracking update" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Map status
    const normalizedStatus = (payload.status || '').toLowerCase().trim();
    const defaultMappings: Record<string, string> = {
      'received': 'processing', 'processing': 'processing', 'compounding': 'processing',
      'ready': 'processing', 'shipped': 'shipped', 'shipping': 'shipped',
      'in_transit': 'shipped', 'in transit': 'shipped', 'delivered': 'delivered',
      'complete': 'delivered', 'completed': 'delivered', 'cancelled': 'cancelled',
      'canceled': 'cancelled', 'returned': 'cancelled', 'refunded': 'cancelled',
    };
    
    const mappedStatus = pharmacy.api_status_mapping?.[normalizedStatus] || defaultMappings[normalizedStatus];

    // Update order line
    const updateData: Record<string, any> = {
      last_status_update_at: new Date().toISOString(),
    };
    
    if (payload.tracking_number) updateData.tracking_number = payload.tracking_number;
    if (payload.carrier) updateData.shipping_carrier = payload.carrier;
    if (mappedStatus) {
      updateData.status = mappedStatus;
      if (mappedStatus === 'delivered') updateData.delivered_at = payload.status_datetime || new Date().toISOString();
      if (mappedStatus === 'shipped') updateData.shipped_at = payload.status_datetime || new Date().toISOString();
    }
    
    await supabaseAdmin
      .from("order_lines")
      .update(updateData)
      .eq("id", orderLineId);

    // Log successful replay
    await supabaseAdmin
      .from("pharmacy_webhook_events")
      .insert({
        pharmacy_id: pharmacy.id,
        webhook_path: originalEvent.webhook_path,
        request_headers: { replayed_by: user.email },
        raw_payload: originalEvent.raw_payload,
        transformed_payload: originalEvent.transformed_payload,
        order_line_id: orderLineId,
        status_code: 200,
        response_body: { success: true, message: "Replay successful" },
        error_message: null,
        processing_time_ms: 0,
        is_duplicate: false,
        replayed_from_event_id: eventId,
      });

    edgeLogger.info('Successfully replayed webhook event', {
      originalEventId: eventId,
      orderLineId,
      status: payload.status,
      mappedStatus,
      adminUserId: user.id
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook replayed successfully",
        orderLineId,
        originalEventId: eventId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    edgeLogger.error('Error in replay-pharmacy-webhook', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});