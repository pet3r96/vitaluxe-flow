/**
 * Send VIOS Order Edge Function
 * 
 * Submits orders to VIOS Compounding Pharmacy API.
 * Uses the unified VIOS integration module for all API interactions.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import {
  isViosEnabled,
  submitViosOrder,
  validateOrderLineForVios,
  type OrderLineData,
  type PracticeData
} from '../_shared/vios/index.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isViosEnabled()) {
    return new Response(
      JSON.stringify({ success: false, error: "VIOS integration is disabled", code: "VIOS_DISABLED" }),
      { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseAdmin = createAdminClient();
    const { order_id, order_line_id, is_test_order = false, memo } = await req.json();

    if (!order_id || !order_line_id) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id and order_line_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order line with required data
    const { data: orderLine, error: lineError } = await supabaseAdmin
      .from("order_lines")
      .select(`*, products(id, name, vios_lf_product_id, is_glp1, glp1_clinical_statement, product_types(is_glp, glp_clinical_statement)), product_variants!order_lines_variant_id_fkey(id, dosage_label, product_code), providers!order_lines_provider_id_fkey(user_id, profiles!providers_user_id_fkey(name, npi, dea, phone)), patient_accounts!order_lines_patient_id_fkey(first_name, last_name, date_of_birth, birth_date, gender_at_birth, address_city, address_state, address_zip, address_street)`)
      .eq("id", order_line_id)
      .single();

    if (lineError || !orderLine) {
      return new Response(
        JSON.stringify({ success: false, error: `Order line not found: ${lineError?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (orderLine.pharmacy_order_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Already submitted", existing_order_id: orderLine.pharmacy_order_id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: order } = await supabaseAdmin.from("orders").select(`doctor_id, profiles!orders_doctor_id_fkey(id, name, npi, dea, phone)`).eq("id", order_id).single();
    
    const practice: PracticeData = { id: order?.doctor_id || '', name: order?.profiles?.name, npi: order?.profiles?.npi, dea: order?.profiles?.dea, phone: order?.profiles?.phone };
    const orderLineData = orderLine as unknown as OrderLineData;
    
    const validation = validateOrderLineForVios(orderLineData, practice);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: "Validation failed", validation_errors: validation.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await submitViosOrder(orderLineData, practice, { isTestOrder: is_test_order, memo, skipValidation: true });

    if (result.success) {
      await supabaseAdmin.from("order_lines").update({ pharmacy_order_id: result.orderId, pharmacy_order_metadata: result.metadata }).eq("id", order_line_id);
    }

    return new Response(
      JSON.stringify({ success: result.success, vios_order_id: result.orderId, rx_number: result.rxNumber, error: result.error }),
      { status: result.success ? 200 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    edgeLogger.error("VIOS order error", error instanceof Error ? error : new Error(String(error)));
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
