/**
 * Send VIOS Order Edge Function
 * 
 * Submits orders to VIOS Compounding Pharmacy API.
 * Uses the unified VIOS integration module for all API interactions.
 * 
 * Features:
 * - Pre-submission validation (NPI, patient data, GLP-1 statements)
 * - Prescription PDF fetching and Base64 encoding for controlled substances
 * - Gating: only submits when prescription is present (for real orders)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import {
  isViosEnabled,
  submitViosOrder,
  validateOrderLineForVios,
  isControlledSubstance,
  type OrderLineData,
  type PracticeData
} from '../_shared/vios/index.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Fetch prescription PDF from storage and encode as Base64
 */
async function fetchPrescriptionPdf(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  prescriptionUrl: string | null | undefined
): Promise<string | null> {
  if (!prescriptionUrl) return null;
  
  try {
    // Extract bucket and path from URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/prescriptions/...
    // or just the path: prescriptions/order_id/file.pdf
    let bucket = 'prescriptions';
    let path = prescriptionUrl;
    
    if (prescriptionUrl.includes('/storage/v1/object/')) {
      const match = prescriptionUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)/);
      if (match) {
        bucket = match[1];
        path = match[2];
      }
    }
    
    edgeLogger.info("Fetching prescription PDF", { bucket, path: path.substring(0, 50) });
    
    const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
    
    if (error || !data) {
      edgeLogger.warn("Failed to fetch prescription PDF", { error: error?.message, path });
      return null;
    }
    
    // Convert blob to base64
    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    edgeLogger.info("Prescription PDF fetched and encoded", { sizeKb: Math.round(base64.length / 1024) });
    return base64;
  } catch (err) {
    edgeLogger.error("Error fetching prescription PDF", err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}

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

    edgeLogger.info("Processing VIOS order", { order_id, order_line_id, is_test_order });

    // Fetch order line with required data
    const { data: orderLine, error: lineError } = await supabaseAdmin
      .from("order_lines")
      .select(`
        *, 
        products(
          id, name, vios_lf_product_id, is_glp1, glp1_clinical_statement, schedule_code,
          product_types(is_glp, glp_clinical_statement)
        ), 
        product_variants!order_lines_variant_id_fkey(id, dosage_label, product_code), 
        providers!order_lines_provider_id_fkey(
          user_id, 
          profiles!providers_user_id_fkey(name, npi, dea, phone)
        ), 
        patient_accounts!order_lines_patient_id_fkey(
          first_name, last_name, date_of_birth, birth_date, gender_at_birth, 
          address_city, address_state, address_zip, address_street,
          driver_license_number, driver_license_state, state_issued_id
        )
      `)
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

    const { data: order } = await supabaseAdmin.from("orders").select(`doctor_id, profiles!orders_doctor_id_fkey(id, name, npi, dea, phone)`).eq("id", order_id).maybeSingle();
    
    const profileData = Array.isArray(order?.profiles) ? order.profiles[0] : order?.profiles;
    const practice: PracticeData = { id: order?.doctor_id || '', name: profileData?.name, npi: profileData?.npi, dea: profileData?.dea, phone: profileData?.phone };
    const orderLineData = orderLine as unknown as OrderLineData;
    
    // Validate with test order flag
    const validation = validateOrderLineForVios(orderLineData, practice, { isTestOrder: is_test_order });
    if (!validation.valid) {
      // Update order line status to routing error
      await supabaseAdmin.from("order_lines").update({
        status: "pharmacy_routing_error"
      }).eq("id", order_line_id);
      
      return new Response(
        JSON.stringify({ success: false, error: "Validation failed", validation_errors: validation.errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch prescription PDF for controlled substances or when present
    let pdfBase64: string | null = null;
    if (orderLineData.prescription_url) {
      pdfBase64 = await fetchPrescriptionPdf(supabaseAdmin, orderLineData.prescription_url);
      
      // For controlled substances, PDF is mandatory
      if (isControlledSubstance(orderLineData) && !pdfBase64) {
        await supabaseAdmin.from("order_lines").update({
          status: "pharmacy_routing_error"
        }).eq("id", order_line_id);
        
        return new Response(
          JSON.stringify({ success: false, error: "Controlled substance requires prescription PDF but fetch failed" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Get pharmacy ID for logging
    const pharmacyId = orderLineData.assigned_pharmacy_id || null;

    // Submit to VIOS
    const result = await submitViosOrder(orderLineData, practice, { 
      isTestOrder: is_test_order, 
      memo, 
      skipValidation: true,
      pdfBase64 
    });

    // Log transmission to pharmacy_order_transmissions (sanitized - no PHI)
    try {
      const sanitizedPayload = {
        product_id: orderLineData.products?.vios_lf_product_id,
        variant_product_code: orderLineData.product_variants?.product_code,
        quantity: result.metadata?.quantity || orderLineData.quantity,
        is_test_order,
        has_pdf: !!pdfBase64,
        dosage_label: orderLineData.product_variants?.dosage_label,
      };
      await supabaseAdmin.from("pharmacy_order_transmissions").insert({
        order_id,
        order_line_id,
        pharmacy_id: pharmacyId,
        transmission_type: 'order',
        api_endpoint: '/api/orders',
        request_payload: sanitizedPayload,
        response_status: result.success ? 200 : 400,
        response_body: { orderId: result.orderId, rxNumber: result.rxNumber, error: result.error },
        success: result.success,
        error_message: result.error || null,
        transmitted_at: new Date().toISOString(),
        pharmacy_order_id: result.orderId || null,
      });
      edgeLogger.info("Transmission logged", { order_line_id, success: result.success });
    } catch (logErr) {
      edgeLogger.warn("Failed to log transmission", { error: logErr instanceof Error ? logErr.message : String(logErr) });
    }

    if (result.success) {
      await supabaseAdmin.from("order_lines").update({ 
        pharmacy_order_id: result.orderId, 
        pharmacy_order_metadata: result.metadata,
        status: "sent_to_pharmacy"
      }).eq("id", order_line_id);
      
      edgeLogger.info("VIOS order submitted successfully", { 
        order_line_id, 
        vios_order_id: result.orderId,
        rx_number: result.rxNumber 
      });
    } else {
      edgeLogger.warn("VIOS order submission failed", { 
        order_line_id, 
        error: result.error 
      });
    }

    return new Response(
      JSON.stringify({ 
        success: result.success, 
        vios_order_id: result.orderId, 
        rx_number: result.rxNumber, 
        error: result.error,
        warnings: validation.warnings
      }),
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
