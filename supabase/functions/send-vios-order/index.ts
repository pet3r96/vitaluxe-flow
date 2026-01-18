import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { viosApiRequest, VIOS_API_URL } from '../_shared/viosAuth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendViosOrderRequest {
  order_id: string;
  order_line_ids: string[];
  pharmacy_id: string;
  is_test_order?: boolean;
}

// ============= VIOS Types per OpenAPI Spec =============

// VIOS Shipping Service Codes (per VIOS documentation)
const VIOS_SHIPPING_CODES: Record<string, number> = {
  'priority_overnight': 7617,      // FedEx Priority Overnight
  'standard_overnight': 7618,      // FedEx Standard Overnight
  'overnight_california': 7620,    // FedEx Standard Overnight - CA
  '2_day': 7608,                   // FedEx 2 Day
  'ground': 7623,                  // FedEx Ground
  'usps_priority': 7615,           // USPS Priority
  'overnight': 7618,               // Default overnight
  'express': 7617,                 // Express = Priority Overnight
  'standard': 7623,                // Standard = Ground
};

/**
 * VIOS Order Payload - per CreateOrderRequest schema
 */
interface ViosOrderPayload {
  general: {
    memo?: string;
    referenceId?: string;
    isTestOrder?: boolean;
    masterOrderLinkRequest?: number;
    masterOrderLinkScope?: 'Billing' | 'Shipping' | 'All';
  };
  document?: {
    pdfBase64?: string;
  };
  prescriber: {
    npi: string;
    lastName: string;
    firstName: string;
    dea?: string;
    phone?: string;
    fax?: string;
  };
  patient: {
    lastName: string;
    firstName: string;
    middleName?: string;
    gender: 'm' | 'f' | 'a' | 'u';
    dateOfBirth: string;
    phoneHome?: string;
    phoneMobile?: string;
    email?: string;
    allergies?: number[];
    allergiesRaw?: string[];
  };
  shipping: {
    service: number;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zipCode: string;        // NOTE: "zipCode" not "zip" per OpenAPI spec
    recipientType?: 'clinic' | 'patient';
    recipientFirstName?: string;
    recipientLastName?: string;
    recipientPhone?: string;
    requireSignature?: boolean;
    saturdayDelivery?: boolean;
  };
  rxs: Array<{
    rxType: 'new' | 'refill' | 'transfer';  // REQUIRED per spec
    quantity: string;                        // STRING per spec, MUST be VOLUME
    directions: string;                      // "directions" not "sig" per spec
    lfProductId?: number;                    // integer per spec
    drugName?: string;
    drugStrength?: string;
    drugForm?: string;
    quantityUnits?: string;
    foreignRxNumber?: string;
    clinicalDifferenceStatement?: string;    // REQUIRED for GLP-1
    specialInstructions?: string;
    scheduleCode?: '2' | '3' | '4' | '5' | 'L' | 'O';
    refills?: number;
    daysSupply?: number;
    dateWritten?: string;
  }>;
}

interface ViosOrderResponse {
  orderId?: number;
  orderLfId?: number;
  rxs?: Array<{ rxLfId?: number; foreignRxNumber?: string }>;
  OrderId?: string;
  rxNumber?: string;
  RxNumber?: string;
  fillId?: string;
  FillId?: string;
  status?: string;
  Status?: string;
  message?: string;
  Message?: string;
  errors?: string[];
  Errors?: string[];
}

// ============= Utility Functions =============

/**
 * Validate volume-based quantity per VIOS critical requirements
 */
function validateVolumeQuantity(quantity: number, productName: string): { warning?: string } {
  if (productName?.toLowerCase().includes('vial') && quantity <= 3) {
    return {
      warning: `Low quantity (${quantity}) for vial product - verify this is in mL, not vial count`
    };
  }
  return {};
}

/**
 * Format phone number to VIOS required format: (XXX) XXX-XXXX
 */
function formatViosPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  
  if (last10.length !== 10) return phone;
  
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

/**
 * Parse patient name into first/last components
 */
function parsePatientName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const lastName = parts.pop() || '';
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

/**
 * Parse prescriber name into first/last components
 */
function parsePrescriberName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0] };
  }
  const lastName = parts.pop() || '';
  const firstName = parts.join(' ');
  return { firstName, lastName };
}

/**
 * Format date of birth to YYYY-MM-DD format
 */
function formatDateOfBirth(dob: string | null): string {
  if (!dob) return '';
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return dob;
  }
  
  try {
    const date = new Date(dob);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch {
    // Fall through
  }
  
  return dob;
}

/**
 * Get VIOS shipping service code
 */
function getViosShippingCode(shippingSpeed: string | null): number {
  if (!shippingSpeed) return VIOS_SHIPPING_CODES.standard;
  
  const normalizedSpeed = shippingSpeed.toLowerCase().replace(/[-_\s]/g, '_');
  return VIOS_SHIPPING_CODES[normalizedSpeed] || VIOS_SHIPPING_CODES.standard;
}

/**
 * Parse address into components
 */
function parseAddress(address: string | null): {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
} {
  if (!address) {
    return { addressLine1: '', city: '', state: '', zipCode: '' };
  }

  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const addressLine1 = parts[0];
    const city = parts[1];
    const stateZipPart = parts[2] || '';
    
    const stateZipMatch = stateZipPart.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/);
    const state = stateZipMatch?.[1] || '';
    const zipCode = stateZipMatch?.[2] || '';
    
    return { addressLine1, city, state, zipCode };
  }
  
  return { addressLine1: address, city: '', state: '', zipCode: '' };
}

/**
 * Check if product requires clinical difference statement (GLP-1)
 */
function requiresClinicalStatement(productName: string): boolean {
  const glp1Keywords = [
    'semaglutide', 'tirzepatide', 'liraglutide', 'dulaglutide',
    'exenatide', 'glp-1', 'glp1', 'ozempic', 'wegovy', 'mounjaro',
    'saxenda', 'victoza', 'trulicity', 'byetta', 'bydureon'
  ];
  
  const lowerName = productName?.toLowerCase() || '';
  return glp1Keywords.some(keyword => lowerName.includes(keyword));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createAdminClient();

    const { 
      order_id, 
      order_line_ids, 
      pharmacy_id, 
      is_test_order = false 
    }: SendViosOrderRequest = await req.json();

    edgeLogger.info("Processing VIOS order submission", { 
      order_id, 
      lineCount: order_line_ids.length, 
      pharmacy_id,
      isTestOrder: is_test_order 
    });

    // Fetch pharmacy to verify it's VIOS
    const { data: pharmacy, error: pharmacyError } = await supabaseAdmin
      .from("pharmacies")
      .select("*")
      .eq("id", pharmacy_id)
      .single();

    if (pharmacyError || !pharmacy) {
      throw new Error(`Pharmacy not found: ${pharmacyError?.message}`);
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

    // Fetch order lines with all related data
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
          dosage,
          form,
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
          product_code,
          form
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

    // Filter out lines already sent
    const unsentLines = orderLines.filter(line => !line.pharmacy_order_id);
    
    if (unsentLines.length === 0) {
      edgeLogger.info("All order lines already sent to VIOS");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "All order lines already sent to VIOS"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Decrypt patient contact data
    for (const line of unsentLines) {
      try {
        const { data: decryptedContact, error: decryptContactError } = await supabaseAdmin.rpc(
          'decrypt_order_line_contact_service',
          { p_order_line_id: line.id }
        );
        
        if (!decryptContactError && decryptedContact && decryptedContact.length > 0) {
          const contact = decryptedContact[0];
          if (contact.patient_email && contact.patient_email !== '[ENCRYPTED]') {
            line.patient_email = contact.patient_email;
          }
          if (contact.patient_phone && contact.patient_phone !== '[ENCRYPTED]') {
            line.patient_phone = contact.patient_phone;
          }
          if (contact.patient_address && contact.patient_address !== '[ENCRYPTED]') {
            line.patient_address = contact.patient_address;
          }
        }
      } catch (decryptErr) {
        edgeLogger.warn("Error decrypting patient contact", { 
          orderLineId: line.id, 
          error: decryptErr instanceof Error ? decryptErr.message : String(decryptErr)
        });
      }
    }

    // Fetch patient allergies with VIOS codes
    const patientIds = [...new Set(unsentLines.map(l => l.patient_id).filter(Boolean))];
    const patientAllergiesMap: Record<string, number[]> = {};
    
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
            patientAllergiesMap[patientId] = [];
          }
          const recordData = record.record_data as any;
          const viosCode = recordData?.vios_code;
          
          // Skip NKA records
          if (recordData?.nka) continue;
          
          if (typeof viosCode === 'number') {
            patientAllergiesMap[patientId].push(viosCode);
          }
        }
      }
    }

    // Process each order line
    const results: Array<{
      orderLineId: string;
      success: boolean;
      viosOrderId?: string;
      viosRxNumber?: string;
      error?: string;
    }> = [];

    for (const line of unsentLines) {
      try {
        // Get product code - prefer variant, then product-level
        const productCodeRaw = line.product_variants?.product_code || 
                           line.products?.vios_lf_product_id || 
                           null;
        
        // Convert to number for lfProductId (integer per OpenAPI spec)
        const productCode = productCodeRaw ? parseInt(String(productCodeRaw), 10) : null;

        // Validate product code if catalog is populated
        if (productCode && !isNaN(productCode)) {
          const { data: catalogEntry } = await supabaseAdmin
            .from("vios_product_catalog")
            .select("med_id, product_name")
            .eq("med_id", String(productCode))
            .single();
          
          if (!catalogEntry) {
            edgeLogger.warn("Product code not found in VIOS catalog", { 
              productCode, 
              productName: line.products?.name 
            });
          }
        }

        // Parse patient name
        const patientName = parsePatientName(line.patient_name || '');
        
        // Get patient data from patient_accounts or line directly
        const patient = line.patient_accounts || {} as any;
        const dob = formatDateOfBirth(patient.date_of_birth || patient.birth_date || null);
        const genderRaw = (line.gender_at_birth || patient.gender_at_birth || 'u').toLowerCase().charAt(0);
        const gender = ['m', 'f', 'a', 'u'].includes(genderRaw) ? genderRaw as 'm' | 'f' | 'a' | 'u' : 'u';
        
        // Get prescriber info
        const providerProfile = line.providers?.profiles || {} as any;
        const prescriberName = parsePrescriberName(providerProfile.name || '');
        
        // Parse shipping address
        const shipToPractice = line.ship_to === "practice";
        const shippingAddress = shipToPractice 
          ? (order.profiles?.shipping_address_formatted || order.profiles?.address_formatted || order.profiles?.address || '')
          : (line.patient_address || patient.address_formatted || patient.address || '');
        
        const parsedAddress = parseAddress(shippingAddress);
        
        // Use explicit address components if available
        if (!shipToPractice && patient.address_city) {
          parsedAddress.addressLine1 = patient.address_street || parsedAddress.addressLine1;
          parsedAddress.city = patient.address_city;
          parsedAddress.state = patient.address_state || line.destination_state || '';
          parsedAddress.zipCode = patient.address_zip || '';
        }
        
        // Validate quantity for volume-based products (VIOS critical requirement)
        const quantityVal = line.quantity || 1;
        const quantityValidation = validateVolumeQuantity(quantityVal, line.products?.name || '');
        if (quantityValidation.warning) {
          edgeLogger.warn("Volume quantity warning", { 
            orderLineId: line.id,
            warning: quantityValidation.warning
          });
        }

        // Build Rx item per VIOS CreateOrderRequestRxModel
        const rxItem: ViosOrderPayload['rxs'][0] = {
          rxType: 'new',                            // REQUIRED field
          quantity: String(quantityVal),            // STRING per OpenAPI spec, VOLUME based
          directions: line.custom_sig || 'Use as directed',  // "directions" not "sig"
        };

        // Add product identification (prefer lfProductId for faster processing)
        if (productCode && !isNaN(productCode)) {
          rxItem.lfProductId = productCode;  // integer per spec
        } else {
          // Fall back to drug name/strength/form (all required without lfProductId)
          rxItem.drugName = line.products?.name || '';
          rxItem.drugStrength = line.custom_dosage || line.product_variants?.dosage_label || line.products?.dosage || '';
          rxItem.drugForm = line.product_variants?.form || line.products?.form || '';
        }

        // Add clinical difference statement for GLP-1 products (VIOS requirement)
        const isGlp1 = line.products?.is_glp1 || line.products?.product_types?.is_glp || 
                       requiresClinicalStatement(line.products?.name || '');
        if (isGlp1) {
          rxItem.clinicalDifferenceStatement = 
            line.products?.glp1_clinical_statement || 
            line.products?.product_types?.glp_clinical_statement ||
            'This compounded medication is being prescribed as a clinically different formulation from available FDA-approved products.';
        }

        // Add order notes as special instructions
        if (line.order_notes) {
          rxItem.specialInstructions = line.order_notes;
        }

        // Build VIOS payload per CreateOrderRequest schema
        const viosPayload: ViosOrderPayload = {
          general: {
            isTestOrder: is_test_order,
            referenceId: line.id,  // Our order_line.id for webhook matching
          },
          prescriber: {
            npi: providerProfile.npi || '',
            firstName: prescriberName.firstName,
            lastName: prescriberName.lastName,
            dea: providerProfile.dea,
            phone: formatViosPhone(providerProfile.phone),
          },
          patient: {
            firstName: patient.first_name || patientName.firstName,
            lastName: patient.last_name || patientName.lastName,
            dateOfBirth: dob,
            gender: gender,
            phoneHome: formatViosPhone(line.patient_phone || patient.phone),
            email: line.patient_email || patient.email,
            allergies: patientAllergiesMap[line.patient_id] || [],
          },
          shipping: {
            service: getViosShippingCode(line.shipping_speed),
            addressLine1: parsedAddress.addressLine1,
            addressLine2: parsedAddress.addressLine2,
            city: parsedAddress.city,
            state: parsedAddress.state || line.destination_state || '',
            zipCode: parsedAddress.zipCode,  // "zipCode" per OpenAPI spec
            recipientType: shipToPractice ? 'clinic' : 'patient',
          },
          rxs: [rxItem],
        };

        const hasLfProductId = !!rxItem.lfProductId;

        edgeLogger.info("Submitting order to VIOS", { 
          orderLineId: line.id,
          productCode,
          isTestOrder: is_test_order,
          hasLfProductId,
          rxType: rxItem.rxType,
          hasGlp1Statement: !!rxItem.clinicalDifferenceStatement
        });

        // Submit to VIOS API
        const viosResponse = await viosApiRequest<ViosOrderResponse>('/api/orders', {
          method: 'POST',
          body: viosPayload,
        });

        const viosOrderId = viosResponse.orderId?.toString() || viosResponse.OrderId;
        const viosRxNumber = viosResponse.rxNumber || viosResponse.RxNumber;
        const viosFillId = viosResponse.fillId || viosResponse.FillId;

        // Log transmission
        await supabaseAdmin.from("pharmacy_order_transmissions").insert({
          order_id: order.id,
          order_line_id: line.id,
          pharmacy_id: pharmacy.id,
          transmission_type: "new_order",
          api_endpoint: `${VIOS_API_URL}/api/orders`,
          request_payload: viosPayload,
          response_status: 200,
          response_body: viosResponse,
          pharmacy_order_id: viosOrderId || null,
          success: true,
          error_message: null,
          retry_count: 0,
        });

        // Update order line with VIOS order details
        await supabaseAdmin
          .from("order_lines")
          .update({
            pharmacy_order_id: viosOrderId,
            pharmacy_order_metadata: {
              vios_order_id: viosOrderId,
              vios_rx_number: viosRxNumber,
              vios_fill_id: viosFillId,
              submitted_at: new Date().toISOString(),
              is_test_order: is_test_order,
              used_lf_product_id: hasLfProductId,
            },
            status: 'processing',
            processing_at: new Date().toISOString(),
          })
          .eq("id", line.id);

        results.push({
          orderLineId: line.id,
          success: true,
          viosOrderId,
          viosRxNumber,
        });

        edgeLogger.info("VIOS order submitted successfully", { 
          orderLineId: line.id,
          viosOrderId,
          viosRxNumber
        });

      } catch (lineError) {
        const errorMsg = lineError instanceof Error ? lineError.message : String(lineError);
        
        edgeLogger.error("Failed to submit order line to VIOS", { 
          orderLineId: line.id,
          error: errorMsg
        });

        // Log failed transmission
        await supabaseAdmin.from("pharmacy_order_transmissions").insert({
          order_id: order.id,
          order_line_id: line.id,
          pharmacy_id: pharmacy.id,
          transmission_type: "new_order",
          api_endpoint: `${VIOS_API_URL}/api/orders`,
          request_payload: null,
          response_status: 0,
          response_body: null,
          pharmacy_order_id: null,
          success: false,
          error_message: errorMsg,
          retry_count: 0,
        });

        results.push({
          orderLineId: line.id,
          success: false,
          error: errorMsg,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    edgeLogger.info("VIOS order submission complete", { 
      successCount, 
      failCount,
      isTestOrder: is_test_order
    });

    return new Response(
      JSON.stringify({ 
        success: failCount === 0,
        message: `Submitted ${successCount}/${results.length} order lines to VIOS`,
        results,
        isTestOrder: is_test_order,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("send-vios-order error", { error: errorMsg });
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
