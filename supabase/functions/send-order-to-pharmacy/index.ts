import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { isViosEnabled, VIOS_PHARMACY_IDENTIFIERS as VIOS_IDS } from '../_shared/vios/index.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOrderRequest {
  order_id: string;
  order_line_ids: string[];
  pharmacy_id: string;
  is_test_order?: boolean;
}

// Known VIOS pharmacy identifiers (use unified list from vios module)
const VIOS_PHARMACY_IDENTIFIERS = VIOS_IDS;

// Template variable replacement for generic handler
function applyPayloadTemplate(template: any, data: Record<string, any>): any {
  if (typeof template === 'string') {
    // Replace {{variable}} placeholders
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return data[key] !== undefined ? String(data[key]) : '';
    });
  }
  if (Array.isArray(template)) {
    return template.map(item => applyPayloadTemplate(item, data));
  }
  if (typeof template === 'object' && template !== null) {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(template)) {
      result[key] = applyPayloadTemplate(value, data);
    }
    return result;
  }
  return template;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const requestBody: SendOrderRequest = await req.json();
    const { order_id, order_line_ids, pharmacy_id, is_test_order } = requestBody;

    edgeLogger.info("Sending order to pharmacy", { order_id, lineCount: order_line_ids.length, pharmacy_id });

    // Fetch pharmacy API configuration including new fields
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy) {
      throw new Error(`Pharmacy not found: ${pharmacyError?.message}`);
    }

    if (!pharmacy.api_enabled) {
      edgeLogger.info("Pharmacy API not enabled, skipping transmission", { pharmacy_id });
      return new Response(
        JSON.stringify({ success: true, message: "Pharmacy API not enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Check if this is VIOS pharmacy - route to dedicated handler
    const isViosPharmacy = 
      VIOS_PHARMACY_IDENTIFIERS.includes(pharmacy_id) ||
      pharmacy.name?.toLowerCase().includes('vios') ||
      pharmacy.api_endpoint_url?.includes('vioscompounding.com');

    // Route VIOS orders to the dedicated VIOS handler
    if (isViosPharmacy) {
      // Check if VIOS integration is enabled
      if (!isViosEnabled()) {
        edgeLogger.warn("VIOS pharmacy detected but integration is disabled", { pharmacy_id });
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: "VIOS pharmacy integration is currently disabled. Please assign this product to a different pharmacy.",
            code: "VIOS_DISABLED"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      edgeLogger.info("Routing order to VIOS handler", { pharmacy_id, order_id, lineCount: order_line_ids.length });
      
      // Route each order line to the dedicated VIOS handler
      const results: Array<{ order_line_id: string; success: boolean; vios_order_id?: string; error?: string }> = [];
      
      for (const order_line_id of order_line_ids) {
        try {
          const { data: viosResult, error: viosError } = await supabaseAdmin.functions.invoke(
            'send-vios-order',
            {
              body: {
                order_id,
                order_line_id,
                is_test_order: is_test_order || false
              }
            }
          );
          
          if (viosError) {
            results.push({ order_line_id, success: false, error: viosError.message });
          } else {
            results.push({ 
              order_line_id, 
              success: viosResult?.success || false, 
              vios_order_id: viosResult?.vios_order_id,
              error: viosResult?.error
            });
          }
        } catch (err) {
          results.push({ 
            order_line_id, 
            success: false, 
            error: err instanceof Error ? err.message : String(err)
          });
        }
      }
      
      const allSuccess = results.every(r => r.success);
      const successCount = results.filter(r => r.success).length;
      
      edgeLogger.info("VIOS order routing complete", { 
        order_id, 
        totalLines: results.length, 
        successCount,
        allSuccess
      });
      
      return new Response(
        JSON.stringify({ 
          success: allSuccess,
          handler: "vios",
          error: allSuccess ? undefined : results.filter(r => !r.success).map(r => r.error).join('; '),
          results,
          summary: `${successCount}/${results.length} order lines submitted successfully`
        }),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: allSuccess ? 200 : 207
        }
      );
    }

    // Fetch order data with practice info including credentials for fallback
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select(`
        *, 
        profiles!orders_doctor_id_fkey(
          name, 
          email,
          address,
          address_formatted,
          shipping_address_formatted,
          npi,
          dea,
          phone
        )
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message}`);
    }

    // Fetch all order lines data with provider credentials, patient account data, product details, and variant info
    const { data: orderLines, error: linesError } = await supabaseAdmin
      .from("order_lines")
      .select(`
        *,
        products(
          id,
          name,
          vios_lf_product_id,
          is_glp1,
          glp1_clinical_statement,
          product_types(
            id,
            name,
            is_glp,
            glp_clinical_statement
          )
        ),
        product_variants!order_lines_variant_id_fkey(
          id,
          dosage_label,
          product_code
        ),
        providers!order_lines_provider_id_fkey(
          user_id,
          profiles!providers_user_id_fkey(
            name,
            npi,
            dea,
            address,
            address_formatted,
            phone,
            email
          )
        ),
        patient_accounts!order_lines_patient_id_fkey(
          first_name,
          last_name,
          email,
          phone,
          date_of_birth,
          birth_date,
          gender_at_birth,
          allergies,
          address,
          address_street,
          address_suite,
          address_city,
          address_state,
          address_zip,
          address_formatted
        )
      `)
      .in("id", order_line_ids);

    if (linesError || !orderLines || orderLines.length === 0) {
      throw new Error(`Order lines not found: ${linesError?.message}`);
    }

    // Filter out lines already sent to pharmacy
    const unsent_lines = orderLines.filter(line => !line.pharmacy_order_id);
    
    if (unsent_lines.length === 0) {
      edgeLogger.info("All order lines already sent to pharmacy");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All order lines already sent to pharmacy"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    edgeLogger.info("Processing unsent order lines", { count: unsent_lines.length });

    // Decrypt patient contact data for each order line using service role function
    for (const line of unsent_lines) {
      try {
        const { data: decryptedContact, error: decryptContactError } = await supabaseAdmin.rpc(
          'decrypt_order_line_contact_service',
          { p_order_line_id: line.id }
        );
        
        if (!decryptContactError && decryptedContact && decryptedContact.length > 0) {
          const contact = decryptedContact[0];
          // Replace encrypted values with decrypted ones
          if (contact.patient_email && contact.patient_email !== '[ENCRYPTED]') {
            line.patient_email = contact.patient_email;
          }
          if (contact.patient_phone && contact.patient_phone !== '[ENCRYPTED]') {
            line.patient_phone = contact.patient_phone;
          }
          if (contact.patient_address && contact.patient_address !== '[ENCRYPTED]') {
            line.patient_address = contact.patient_address;
          }
          edgeLogger.info("Decrypted patient contact", { 
            orderLineId: line.id,
            hasEmail: !!contact.patient_email,
            hasPhone: !!contact.patient_phone,
            hasAddress: !!contact.patient_address
          });
        } else if (decryptContactError) {
          edgeLogger.warn("Failed to decrypt patient contact", { 
            orderLineId: line.id, 
            error: decryptContactError.message 
          });
        }
      } catch (decryptErr) {
        edgeLogger.warn("Error decrypting patient contact", { 
          orderLineId: line.id, 
          error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr)
        });
      }
    }

    // Fetch allergies from patient_medical_vault for each patient
    const patientIds = [...new Set(unsent_lines.map(l => l.patient_id).filter(Boolean))];
    const patientAllergiesMap: Record<string, { names: string[]; viosCodes: number[] }> = {};
    
    if (patientIds.length > 0) {
      const { data: allergyRecords } = await supabaseAdmin
        .from("patient_medical_vault")
        .select("patient_account_id, record_data")
        .in("patient_account_id", patientIds)
        .eq("record_type", "allergy")
        .eq("is_active", true);
      
      if (allergyRecords && allergyRecords.length > 0) {
        for (const record of allergyRecords) {
          const patientId = record.patient_account_id;
          if (!patientAllergiesMap[patientId]) {
            patientAllergiesMap[patientId] = { names: [], viosCodes: [] };
          }
          const recordData = record.record_data as any;
          const allergenName = recordData?.allergen_name;
          const viosCode = recordData?.vios_code;
          
          // Skip NKA records
          if (recordData?.nka) continue;
          
          if (allergenName) {
            patientAllergiesMap[patientId].names.push(allergenName);
          }
          if (typeof viosCode === 'number') {
            patientAllergiesMap[patientId].viosCodes.push(viosCode);
          }
        }
        edgeLogger.info("Fetched patient allergies", { 
          patientCount: Object.keys(patientAllergiesMap).length,
          totalAllergies: Object.values(patientAllergiesMap).reduce((sum, p) => sum + p.names.length, 0),
          totalViosCodes: Object.values(patientAllergiesMap).reduce((sum, p) => sum + p.viosCodes.length, 0)
        });
      }
    }
    
    // Attach allergies to each order line's patient_accounts object
    for (const line of unsent_lines) {
      if (line.patient_id && patientAllergiesMap[line.patient_id]) {
        const patientAllergies = patientAllergiesMap[line.patient_id];
        const allergiesStr = patientAllergies.names.length > 0 
          ? patientAllergies.names.join(", ") 
          : "NKA";
        if (line.patient_accounts) {
          line.patient_accounts.allergies = allergiesStr;
          // Add VIOS codes array for pharmacy API
          (line.patient_accounts as any).allergy_codes = patientAllergies.viosCodes;
        } else {
          line.patient_accounts = { 
            allergies: allergiesStr,
            allergy_codes: patientAllergies.viosCodes 
          } as any;
        }
      } else if (line.patient_accounts && !line.patient_accounts.allergies) {
        line.patient_accounts.allergies = "NKA"; // No Known Allergies
        (line.patient_accounts as any).allergy_codes = [];
      }
    }

    // Fetch API credentials with decryption
    let credentials: any[] = [];
    try {
      const { data: decrypted, error: decryptError } = await supabaseAdmin.rpc('decrypt_pharmacy_credentials_batch', {
        p_pharmacy_id: pharmacy_id
      });
      
      if (decryptError) {
        edgeLogger.error("Failed to decrypt credentials", { error: decryptError.message });
      } else {
        credentials = decrypted || [];
        edgeLogger.info("Decrypted credentials", { 
          count: credentials.length,
          types: credentials.map((c: any) => c.credential_type)
        });
      }
    } catch (err) {
      edgeLogger.error("RPC decrypt error", { error: err instanceof Error ? err.message : String(err) });
    }

    // ==========================================
    // STANDARD API HANDLER (Generic REST API)
    // ==========================================
    
    // Build default payload structure
    const defaultPayload = {
      order_id: order.id,
      vitaluxe_order_number: order.order_number,
      created_at: order.created_at,
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
          patient_allergies: line.patient_accounts?.allergies || "NKA",
          patient_allergy_codes: (line.patient_accounts as any)?.allergy_codes || [],
          ship_to: line.ship_to || "patient",
          shipping_address: shippingAddress,
          product: {
            name: line.products?.name || "Unknown",
            product_code: line.product_variants?.product_code || line.products?.vios_lf_product_id || null,
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

    // Apply custom payload template if configured
    let payload = defaultPayload;
    if (pharmacy.api_payload_template) {
      try {
        // Flatten data for template substitution
        const templateData: Record<string, any> = {
          order_id: order.id,
          order_number: order.order_number,
          created_at: order.created_at,
          practice_name: order.profiles?.name,
          practice_email: order.profiles?.email,
          practice_address: order.profiles?.address_formatted || order.profiles?.address,
        };
        
        // For single-line orders, add line-specific data
        if (unsent_lines.length === 1) {
          const line = unsent_lines[0];
          templateData.patient_name = line.patient_name;
          templateData.patient_address = line.patient_address;
          templateData.patient_phone = line.patient_phone;
          templateData.patient_email = line.patient_email;
          templateData.product_name = line.products?.name;
          templateData.product_code = line.product_variants?.product_code || line.products?.vios_lf_product_id;
          templateData.quantity = line.quantity;
          templateData.custom_sig = line.custom_sig;
          templateData.custom_dosage = line.custom_dosage;
          templateData.shipping_speed = line.shipping_speed;
        }
        
        payload = applyPayloadTemplate(pharmacy.api_payload_template, templateData);
        edgeLogger.info("Applied custom payload template");
      } catch (templateError) {
        edgeLogger.error("Failed to apply payload template", { error: templateError instanceof Error ? templateError.message : String(templateError) });
        // Continue with default payload
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((pharmacy.api_custom_headers as Record<string, string>) || {})
    };

    // Add authentication
    const apiKeyCred = credentials.find(c => c.credential_type === 'api_key');
    const bearerTokenCred = credentials.find(c => c.credential_type === 'bearer_token');
    
    if (pharmacy.api_auth_type === 'bearer' && bearerTokenCred) {
      headers['Authorization'] = `Bearer ${bearerTokenCred.credential_key}`;
    } else if (pharmacy.api_auth_type === 'api_key' && apiKeyCred) {
      const keyName = pharmacy.api_auth_key_name || 'X-API-Key';
      headers[keyName] = apiKeyCred.credential_key;
    }

    // Check if endpoint is configured
    if (!pharmacy.api_endpoint_url) {
      edgeLogger.info("No API endpoint configured for pharmacy", { pharmacy_id });
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No API endpoint configured. Please configure the pharmacy API settings." 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Make the API request
    const method = pharmacy.api_http_method || 'POST';
    const timeout = (pharmacy.api_timeout_seconds || 30) * 1000;
    
    edgeLogger.info("Sending order to pharmacy API", { 
      endpoint: pharmacy.api_endpoint_url,
      method,
      orderLinesCount: unsent_lines.length
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(pharmacy.api_endpoint_url, {
        method,
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const responseText = await response.text();
      let responseBody: any;
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { text: responseText };
      }
      
      // Log transmission
      for (const line of unsent_lines) {
        await supabaseAdmin.from("pharmacy_order_transmissions").insert({
          order_id: order.id,
          order_line_id: line.id,
          pharmacy_id: pharmacy.id,
          transmission_type: "new_order",
          api_endpoint: pharmacy.api_endpoint_url,
          request_payload: payload,
          response_status: response.status,
          response_body: responseBody,
          pharmacy_order_id: responseBody?.order_id || responseBody?.orderId || null,
          success: response.ok,
          error_message: response.ok ? null : `HTTP ${response.status}: ${responseText.substring(0, 500)}`,
          retry_count: 0,
        });
        
        // Update order line with pharmacy order ID if provided
        if (response.ok && (responseBody?.order_id || responseBody?.orderId)) {
          await supabaseAdmin
            .from("order_lines")
            .update({
              pharmacy_order_id: String(responseBody.order_id || responseBody.orderId),
              pharmacy_order_metadata: responseBody
            })
            .eq("id", line.id);
        }
      }
      
      if (response.ok) {
        edgeLogger.info("Order sent successfully", { 
          pharmacy_id,
          order_id,
          status: response.status
        });
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            response: responseBody,
            orderLinesProcessed: unsent_lines.length
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      } else {
        edgeLogger.error("Pharmacy API returned error", {
          status: response.status,
          response: responseBody
        });
        
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Pharmacy API error (${response.status}): ${responseText.substring(0, 500)}`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      edgeLogger.error("Failed to send order to pharmacy", { error: errorMsg });
      
      // Log failed transmission
      for (const line of unsent_lines) {
        await supabaseAdmin.from("pharmacy_order_transmissions").insert({
          order_id: order.id,
          order_line_id: line.id,
          pharmacy_id: pharmacy.id,
          transmission_type: "new_order",
          api_endpoint: pharmacy.api_endpoint_url,
          request_payload: payload,
          response_status: 0,
          response_body: null,
          pharmacy_order_id: null,
          success: false,
          error_message: errorMsg,
          retry_count: 0,
        });
      }
      
      return new Response(
        JSON.stringify({ success: false, error: errorMsg }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("send-order-to-pharmacy error", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
