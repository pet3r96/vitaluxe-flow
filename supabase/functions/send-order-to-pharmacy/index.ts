import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { getViosCredentials, getViosToken as getViosTokenShared } from '../_shared/viosApi.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOrderRequest {
  order_id: string;
  order_line_ids: string[];
  pharmacy_id: string;
}

// Official VIOS shipping service codes per Swagger spec
// These are the actual service IDs from the VIOS API
const DEFAULT_VIOS_SHIPPING_CODES: Record<string, number> = {
  'ground': 7623,      // FedEx Ground
  '2day': 7608,        // FEDEX 2 DAY
  'overnight': 7618,   // FEDEX STANDARD OVERNIGHT
  'priority': 7615     // USPS PRIORITY
};

// Get VIOS shipping service code from database or use default
async function getViosShippingCode(
  supabaseAdmin: any,
  pharmacyId: string,
  shippingSpeed: string
): Promise<{ code: number; enabled: boolean }> {
  // Try to get configured code from database
  const { data: rateData } = await supabaseAdmin
    .from('pharmacy_shipping_rates')
    .select('vios_service_code, enabled')
    .eq('pharmacy_id', pharmacyId)
    .eq('shipping_speed', shippingSpeed)
    .single();

  if (rateData?.vios_service_code) {
    return { 
      code: rateData.vios_service_code, 
      enabled: rateData.enabled === true 
    };
  }

  // Fallback to default mapping
  return { 
    code: DEFAULT_VIOS_SHIPPING_CODES[shippingSpeed] || DEFAULT_VIOS_SHIPPING_CODES['ground'],
    enabled: true // Assume enabled if not in database
  };
}

// Format phone number to VIOS format: (XXX) XXX-XXXX
function formatPhoneForVios(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone; // Return original if can't format
}

// Format date to VIOS format: yyyy-MM-dd
function formatDateForVios(date: string | Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

// Map gender to VIOS format
function mapGenderForVios(gender: string | null): string {
  if (!gender) return 'u';
  const g = gender.toLowerCase();
  if (g === 'm' || g === 'male') return 'm';
  if (g === 'f' || g === 'female') return 'f';
  return 'u';
}

// Parse address into components
function parseAddress(address: string | null): { 
  address1: string | null; 
  city: string | null; 
  state: string | null; 
  zip: string | null; 
} {
  if (!address) return { address1: null, city: null, state: null, zip: null };
  
  // Try to parse formatted address like "123 Main St, City, ST 12345"
  const parts = address.split(',').map(p => p.trim());
  if (parts.length >= 3) {
    const address1 = parts[0];
    const city = parts[1];
    // Last part often has state and zip
    const stateZipMatch = parts[parts.length - 1].match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/i);
    if (stateZipMatch) {
      return {
        address1,
        city,
        state: stateZipMatch[1]?.toUpperCase() || null,
        zip: stateZipMatch[2] || null
      };
    }
  }
  
  return { address1: address, city: null, state: null, zip: null };
}

// Use shared VIOS token function - centralized implementation with caching
// Local wrapper to maintain logging consistency
async function getViosTokenLocal(credentials: { clientId: string; clientSecret: string; baseUrl: string; environment?: string }): Promise<string> {
  edgeLogger.info("VIOS: Fetching JWT token via shared utility", { 
    baseUrl: credentials.baseUrl,
    clientIdPrefix: credentials.clientId?.substring(0, 8) + '...',
    environment: credentials.environment || 'unknown'
  });
  // Add default environment if not provided for backwards compatibility
  const fullCredentials = {
    ...credentials,
    environment: (credentials.environment || 'production') as 'sandbox' | 'production'
  };
  return getViosTokenShared(fullCredentials);
}

// Validate prescriber NPI before transformation
// When testPrescriberNpi is provided (sandbox mode), use it directly without validation
function validatePrescriberNpi(
  orderLine: any, 
  order: any, 
  testPrescriberNpi: string | null = null
): { valid: boolean; npi: string; error?: string } {
  // If test prescriber NPI is provided (sandbox mode), use it directly
  if (testPrescriberNpi) {
    edgeLogger.info("VIOS: Using test prescriber NPI from pharmacy settings", {
      testNpi: testPrescriberNpi
    });
    return { valid: true, npi: testPrescriberNpi };
  }
  
  const providerProfile = orderLine.providers?.profiles;
  const doctorProfile = order.profiles;
  const prescriberProfile = providerProfile || doctorProfile;
  
  const npi = prescriberProfile?.npi;
  
  if (!npi || npi.trim() === '') {
    const providerName = providerProfile?.name || 'Unknown Provider';
    const doctorName = doctorProfile?.name || 'Unknown Practice';
    
    if (providerProfile) {
      return { 
        valid: false, 
        npi: '',
        error: `Provider "${providerName}" does not have an NPI configured. Please add the NPI in provider settings before sending orders to VIOS.`
      };
    } else {
      return { 
        valid: false, 
        npi: '',
        error: `No provider assigned to this order line and practice "${doctorName}" does not have an NPI configured. Please assign a provider with a valid NPI or configure the practice NPI.`
      };
    }
  }
  
  // Validate NPI format (10 digits)
  const npiDigits = npi.replace(/\D/g, '');
  if (npiDigits.length !== 10) {
    return { 
      valid: false, 
      npi: '',
      error: `Invalid NPI format: "${npi}". NPI must be exactly 10 digits.`
    };
  }
  
  return { valid: true, npi: npiDigits };
}

// Transform order to VIOS CreateOrderRequest format
function transformToViosPayload(
  order: any, 
  orderLine: any, 
  prescriptionBase64: string | null,
  isTestMode: boolean = false,
  shippingServiceCode: number = 1, // Default to ground (1)
  testPrescriberNpi: string | null = null // Override NPI for sandbox mode
): any {
  // Get prescriber info - prefer order line provider, fallback to order's doctor (practice)
  const providerProfile = orderLine.providers?.profiles;
  const doctorProfile = order.profiles;
  const prescriberProfile = providerProfile || doctorProfile;
  // Get patient account data if available
  const patientAccount = orderLine.patient_accounts;
  
  // Use patient account address or fall back to order line address
  const patientAddressFormatted = patientAccount?.address_formatted || orderLine.patient_address;
  const patientAddress = patientAccount ? {
    address1: patientAccount.address_street || patientAccount.address || parseAddress(patientAddressFormatted).address1,
    city: patientAccount.address_city || parseAddress(patientAddressFormatted).city,
    state: patientAccount.address_state || parseAddress(patientAddressFormatted).state || orderLine.destination_state,
    zip: patientAccount.address_zip || parseAddress(patientAddressFormatted).zip
  } : parseAddress(orderLine.patient_address);
  
  const prescriberAddress = parseAddress(prescriberProfile?.address_formatted || prescriberProfile?.address);
  const shippingAddress = parseAddress(orderLine.shipping_address || patientAddressFormatted || orderLine.patient_address);
  
  // Get patient name - prefer patient account, fall back to order line
  let patientFirstName: string;
  let patientLastName: string;
  if (patientAccount?.first_name && patientAccount?.last_name) {
    patientFirstName = patientAccount.first_name;
    patientLastName = patientAccount.last_name;
  } else {
    const patientNameParts = (orderLine.patient_name || '').split(' ');
    patientFirstName = patientNameParts[0] || 'Unknown';
    patientLastName = patientNameParts.slice(1).join(' ') || 'Patient';
  }
  
  // Parse prescriber name into first/last (from provider or fallback to doctor/practice)
  const prescriberName = prescriberProfile?.name || '';
  const prescriberNameParts = prescriberName.split(' ');
  const prescriberFirstName = prescriberNameParts[0] || 'Unknown';
  const prescriberLastName = prescriberNameParts.slice(1).join(' ') || 'Provider';
  
  // Get patient DOB - check multiple sources
  const patientDob = patientAccount?.date_of_birth || patientAccount?.birth_date || orderLine.patient_dob;
  
  // Get patient gender - prefer patient account
  const patientGender = patientAccount?.gender_at_birth || orderLine.gender_at_birth;
  
  // Get patient contact info - prefer decrypted order line data, fall back to patient account
  const patientEmail = orderLine.patient_email || patientAccount?.email;
  const patientPhone = orderLine.patient_phone || patientAccount?.phone;
  
  // Get allergies from patient account
  const patientAllergies = patientAccount?.allergies;
  
  // Create short order reference (first 8 chars of UUID for readability)
  const orderRef = order.id.substring(0, 8).toUpperCase();
  
  // Get and validate prescriber NPI - use test NPI if provided (sandbox mode)
  const prescriberNpi = testPrescriberNpi || (prescriberProfile?.npi || '').replace(/\D/g, '');
  
  // Debug logging for critical fields
  edgeLogger.info("VIOS payload data sources", {
    patientAllergies: patientAllergies || 'NKA',
    patientEmail: patientEmail ? '[SET]' : '[MISSING]',
    patientPhone: patientPhone ? '[SET]' : '[MISSING]',
    prescriberPhone: prescriberProfile?.phone ? '[SET]' : '[MISSING]',
    prescriberName: prescriberName,
    prescriberNpi: prescriberNpi || '[MISSING - WILL FAIL]'
  });
  
  // Build memo with allergies info since VIOS allergies field expects integer IDs
  const allergyNote = patientAllergies ? `Allergies: ${patientAllergies}` : 'Allergies: NKA';
  const memoBase = orderLine.order_notes || `VitaLuxe Order #${orderRef}`;
  const fullMemo = `${memoBase} | ${allergyNote}`;
  
  const payload: any = {
    general: {
      referenceId: orderLine.id, // Use order_line_id as reference
      memo: fullMemo,
      isTestOrder: isTestMode // Use test mode flag
    },
    prescriber: {
      npi: prescriberNpi, // Already validated before calling this function
      firstName: prescriberFirstName,
      lastName: prescriberLastName,
      dea: prescriberProfile?.dea || undefined,
      address1: prescriberAddress.address1 || undefined,
      city: prescriberAddress.city || undefined,
      state: prescriberAddress.state || undefined,
      zip: prescriberAddress.zip || undefined,
      phone: formatPhoneForVios(prescriberProfile?.phone) || undefined,
      email: prescriberProfile?.email || undefined
    },
    patient: {
      firstName: patientFirstName,
      lastName: patientLastName,
      gender: mapGenderForVios(patientGender),
      dateOfBirth: formatDateForVios(patientDob) || '1900-01-01', // Required field
      address1: patientAddress.address1 || undefined,
      city: patientAddress.city || undefined,
      state: patientAddress.state || orderLine.destination_state || undefined,
      zip: patientAddress.zip || undefined,
      phoneHome: formatPhoneForVios(patientPhone) || undefined,
      phoneMobile: formatPhoneForVios(patientPhone) || undefined, // Also send as mobile
      email: patientEmail || undefined
      // Note: VIOS allergies field expects integer IDs, not text. Allergies included in memo instead.
    },
    shipping: {
      addressLine1: shippingAddress.address1 || patientAddress.address1 || 'Address Required',
      city: shippingAddress.city || patientAddress.city || 'City Required',
      // Prefer patient address state over parsed shipping state to avoid "USA" country code being used as state
      state: (patientAddress.state || shippingAddress.state || orderLine.destination_state || 'CA').toUpperCase(),
      zipCode: shippingAddress.zip || patientAddress.zip || '00000',
      service: shippingServiceCode,
      recipientType: 'patient',
      recipientFirstName: patientFirstName,
      recipientLastName: patientLastName,
      recipientPhone: formatPhoneForVios(patientPhone) || undefined,
      recipientEmail: patientEmail || undefined
    },
    rxs: [{
      rxType: orderLine.is_refill ? 'refill' : 'new',
      // Use product code with priority: variant product_code > product vios_lf_product_id > drug name
      lfProductId: orderLine.product_variants?.product_code || orderLine.products?.vios_lf_product_id || undefined,
      drugName: (orderLine.product_variants?.product_code || orderLine.products?.vios_lf_product_id) ? undefined : (orderLine.products?.name || 'Unknown Product'),
      quantity: String(orderLine.quantity || 1),
      directions: orderLine.custom_sig || 'As directed',
      drugStrength: orderLine.custom_dosage || undefined,
      refills: orderLine.refills_remaining || 0,
      dateWritten: formatDateForVios(order.created_at) || formatDateForVios(new Date()),
      specialInstructions: orderLine.order_notes || undefined,
      // GLP-1 clinical difference statement (required by FDA for GLP-1 compounds)
      // Check product.is_glp1 flag OR product_type.is_glp OR product_type name starts with GLP
      clinicalDifferenceStatement: (() => {
        const product = orderLine.products;
        const productType = product?.product_types;
        const isGlp = product?.is_glp1 || productType?.is_glp || productType?.name?.startsWith('GLP');
        if (!isGlp) return undefined;
        // Priority: product-level statement > product_type statement > default
        return product?.glp1_clinical_statement || 
               productType?.glp_clinical_statement || 
               'Compounded for customized dosing to meet individual patient needs per prescriber requirements.';
      })()
    }]
  };
  
  // Add prescription PDF if available
  if (prescriptionBase64) {
    payload.document = {
      pdfBase64: prescriptionBase64
    };
  }
  
  return payload;
}

// Send order via VIOS API with enhanced logging and test mode support
async function sendViosOrder(
  pharmacy: any,
  credentials: any[],
  order: any,
  orderLines: any[],
  supabaseAdmin: any
): Promise<{ success: boolean; response?: any; error?: string; testMode?: boolean }> {
  
  const startTime = Date.now();
  
  // Determine if test mode is enabled
  // Check: 1) pharmacy.api_test_mode, 2) environment variable, 3) order metadata
  const isTestMode = pharmacy.api_test_mode === true || 
                     Deno.env.get('VIOS_TEST_MODE') === 'true' ||
                     order.metadata?.testOrder === true;
  
  edgeLogger.info("VIOS: Starting order transmission", {
    pharmacyId: pharmacy.id,
    pharmacyName: pharmacy.name,
    orderId: order.id,
    orderLineCount: orderLines.length,
    testMode: isTestMode
  });
  
  // Get VIOS credentials using shared utility (handles env vars + database fallback)
  const viosCredentials = await getViosCredentials(supabaseAdmin, pharmacy.id);
  
  if (!viosCredentials) {
    edgeLogger.error("VIOS: Missing credentials", {
      pharmacyId: pharmacy.id,
      pharmacyName: pharmacy.name
    });
    return { success: false, error: 'VIOS credentials not configured. Check environment variables or database credentials.' };
  }
  
  edgeLogger.info("VIOS: Configuration resolved", { 
    baseUrl: viosCredentials.baseUrl, 
    testMode: isTestMode,
    hasEndpointUrl: !!pharmacy.api_endpoint_url 
  });
  
  // Alias for use in the rest of this function
  const baseUrl = viosCredentials.baseUrl;
  
  try {
    // Get JWT token using shared utility with caching
    const jwtToken = await getViosTokenLocal(viosCredentials);
    
    const results: any[] = [];
    let allSuccess = true;
    
    // Determine test prescriber NPI for sandbox mode
    const testPrescriberNpi = isTestMode && pharmacy.test_prescriber_npi 
      ? pharmacy.test_prescriber_npi.replace(/\D/g, '') 
      : null;
    
    // DEBUG: Log test NPI configuration for troubleshooting
    edgeLogger.info("VIOS: Test NPI configuration check", {
      pharmacyId: pharmacy.id,
      pharmacyTestNpi: pharmacy.test_prescriber_npi || '[NOT_SET]',
      isTestMode: isTestMode,
      computedTestNpi: testPrescriberNpi || '[NULL_OR_EMPTY]'
    });
    
    if (isTestMode) {
      edgeLogger.info("VIOS: Sandbox mode configuration", {
        isTestMode: true,
        testPrescriberNpi: testPrescriberNpi || '[NOT_CONFIGURED - will use provider NPI]',
        pharmacyId: pharmacy.id
      });
    }
    
    // Send each order line as a separate VIOS order
    for (const orderLine of orderLines) {
      const lineStartTime = Date.now();
      try {
        // Validate prescriber NPI before proceeding (uses test NPI if in sandbox mode)
        const npiValidation = validatePrescriberNpi(orderLine, order, testPrescriberNpi);
        if (!npiValidation.valid) {
          edgeLogger.error("VIOS: Prescriber NPI validation failed", { 
            orderLineId: orderLine.id,
            error: npiValidation.error
          });
          allSuccess = false;
          results.push({ orderLineId: orderLine.id, success: false, error: npiValidation.error });
          continue;
        }
        
        // Get prescription PDF as base64 if available
        let prescriptionBase64: string | null = null;
        if (orderLine.prescription_url) {
          try {
            edgeLogger.info("VIOS: Fetching prescription PDF", { 
              orderLineId: orderLine.id,
              url: orderLine.prescription_url.substring(0, 50) + '...'
            });
            const pdfResponse = await fetch(orderLine.prescription_url);
            if (pdfResponse.ok) {
              const pdfBuffer = await pdfResponse.arrayBuffer();
              prescriptionBase64 = btoa(String.fromCharCode(...new Uint8Array(pdfBuffer)));
              edgeLogger.info("VIOS: Prescription PDF fetched", { 
                orderLineId: orderLine.id,
                pdfSize: pdfBuffer.byteLength 
              });
            }
          } catch (pdfError) {
            edgeLogger.warn("VIOS: Failed to fetch prescription PDF", { 
              orderLineId: orderLine.id,
              error: pdfError instanceof Error ? pdfError.message : String(pdfError) 
            });
          }
        }
        
        // Get shipping service code from database with validation
        const shippingSpeed = orderLine.shipping_speed || 'ground';
        const { code: shippingServiceCode, enabled: shippingEnabled } = await getViosShippingCode(
          supabaseAdmin, 
          pharmacy.id, 
          shippingSpeed
        );
        
        // Validate shipping speed is enabled for this pharmacy
        if (!shippingEnabled) {
          const errorMsg = `Shipping speed '${shippingSpeed}' (service code ${shippingServiceCode}) is not enabled for ${pharmacy.name}. ` +
            `Please contact VIOS to enable this shipping option or select a different speed.`;
          edgeLogger.warn("VIOS: Shipping speed not enabled", { 
            orderLineId: orderLine.id, 
            shippingSpeed,
            serviceCode: shippingServiceCode
          });
          allSuccess = false;
          results.push({ orderLineId: orderLine.id, success: false, error: errorMsg });
          continue;
        }
        
        edgeLogger.info("VIOS: Shipping service code resolved", { 
          orderLineId: orderLine.id,
          shippingSpeed,
          serviceCode: shippingServiceCode 
        });
        
        // Transform to VIOS payload with test mode flag and shipping service code
        // Transform to VIOS payload - pass test NPI for sandbox mode
        const viosPayload = transformToViosPayload(order, orderLine, prescriptionBase64, isTestMode, shippingServiceCode, testPrescriberNpi);
        
        // Log sanitized payload (remove sensitive data)
        const sanitizedPayload = {
          ...viosPayload,
          patient: {
            ...viosPayload.patient,
            socialSecurityNumber: viosPayload.patient?.socialSecurityNumber ? '[REDACTED]' : undefined,
            driverLicenseNumber: viosPayload.patient?.driverLicenseNumber ? '[REDACTED]' : undefined
          },
          document: viosPayload.document ? { pdfBase64: `[${prescriptionBase64?.length || 0} chars]` } : undefined
        };
        
        edgeLogger.info("VIOS: Sending order request", { 
          orderLineId: orderLine.id, 
          referenceId: viosPayload.general.referenceId,
          testMode: isTestMode,
          payload: sanitizedPayload
        });
        
        // Send to VIOS
        const response = await fetch(`${baseUrl}/api/orders`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
          },
          body: JSON.stringify(viosPayload)
        });
        
        const responseText = await response.text();
        let responseBody: any;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = { text: responseText };
        }
        
        const lineDuration = Date.now() - lineStartTime;
        
        if (response.ok) {
          const viosOrderId = responseBody.orderId;
          
          edgeLogger.info("VIOS: Order created successfully", { 
            orderLineId: orderLine.id, 
            viosOrderId,
            testMode: isTestMode,
            duration: lineDuration
          });
          
          // Update order line with VIOS order ID
          await supabaseAdmin
            .from("order_lines")
            .update({
              pharmacy_order_id: String(viosOrderId),
              pharmacy_order_metadata: { ...responseBody, testMode: isTestMode }
            })
            .eq("id", orderLine.id);
          
          // Log successful transmission
          await supabaseAdmin.from("pharmacy_order_transmissions").insert({
            order_id: order.id,
            order_line_id: orderLine.id,
            pharmacy_id: pharmacy.id,
            transmission_type: "new_order",
            api_endpoint: `${baseUrl}/api/orders`,
            request_payload: { ...viosPayload, document: viosPayload.document ? '[PDF_INCLUDED]' : null },
            response_status: response.status,
            response_body: responseBody,
            pharmacy_order_id: String(viosOrderId),
            success: true,
            retry_count: 0,
          });
          
          results.push({ orderLineId: orderLine.id, success: true, viosOrderId, testMode: isTestMode });
        } else {
          allSuccess = false;
          const errorMsg = `VIOS API error (${response.status}): ${JSON.stringify(responseBody)}`;
          
          edgeLogger.error("VIOS: Order failed", { 
            orderLineId: orderLine.id, 
            status: response.status,
            error: responseBody,
            duration: lineDuration
          });
          
          // Log failed transmission
          await supabaseAdmin.from("pharmacy_order_transmissions").insert({
            order_id: order.id,
            order_line_id: orderLine.id,
            pharmacy_id: pharmacy.id,
            transmission_type: "new_order",
            api_endpoint: `${baseUrl}/api/orders`,
            request_payload: { ...viosPayload, document: viosPayload.document ? '[PDF_INCLUDED]' : null },
            response_status: response.status,
            response_body: responseBody,
            pharmacy_order_id: null,
            success: false,
            error_message: errorMsg,
            retry_count: 0,
          });
          
          results.push({ orderLineId: orderLine.id, success: false, error: errorMsg });
        }
      } catch (lineError) {
        allSuccess = false;
        const errorMsg = lineError instanceof Error ? lineError.message : String(lineError);
        edgeLogger.error("VIOS: Error processing order line", { 
          orderLineId: orderLine.id, 
          error: errorMsg,
          stack: lineError instanceof Error ? lineError.stack : undefined
        });
        results.push({ orderLineId: orderLine.id, success: false, error: errorMsg });
      }
    }
    
    const totalDuration = Date.now() - startTime;
    edgeLogger.info("VIOS: Transmission complete", {
      orderId: order.id,
      totalLines: orderLines.length,
      successfulLines: results.filter(r => r.success).length,
      failedLines: results.filter(r => !r.success).length,
      testMode: isTestMode,
      duration: totalDuration
    });
    
    return { 
      success: allSuccess, 
      testMode: isTestMode,
      response: { results, totalLines: orderLines.length, successfulLines: results.filter(r => r.success).length }
    };
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    edgeLogger.error("VIOS API error", { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

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

    const { order_id, order_line_ids, pharmacy_id }: SendOrderRequest = await req.json();

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
    const patientAllergiesMap: Record<string, string[]> = {};
    
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
          const allergenName = (record.record_data as any)?.allergen_name;
          if (allergenName) {
            patientAllergiesMap[patientId].push(allergenName);
          }
        }
        edgeLogger.info("Fetched patient allergies", { 
          patientCount: Object.keys(patientAllergiesMap).length,
          totalAllergies: Object.values(patientAllergiesMap).flat().length 
        });
      }
    }
    
    // Attach allergies to each order line's patient_accounts object
    for (const line of unsent_lines) {
      if (line.patient_id && patientAllergiesMap[line.patient_id]) {
        const allergiesStr = patientAllergiesMap[line.patient_id].join(", ");
        if (line.patient_accounts) {
          line.patient_accounts.allergies = allergiesStr || "NKA";
        } else {
          line.patient_accounts = { allergies: allergiesStr || "NKA" };
        }
      } else if (line.patient_accounts && !line.patient_accounts.allergies) {
        line.patient_accounts.allergies = "NKA"; // No Known Allergies
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
    // VIOS-SPECIFIC HANDLER
    // ==========================================
    if (pharmacy.api_handler_type === 'vios') {
      edgeLogger.info("Using VIOS API handler", { pharmacy_id, pharmacy_name: pharmacy.name });
      
      const viosResult = await sendViosOrder(
        pharmacy,
        credentials || [],
        order,
        unsent_lines,
        supabaseAdmin
      );
      
      // Check for alerts after transmission
      try {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/check-pharmacy-alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
          },
          body: JSON.stringify({
            pharmacy_id: pharmacy.id,
            check_types: viosResult.success ? ['consecutive_failures'] : ['consecutive_failures', 'high_failure_rate']
          })
        });
      } catch (alertError) {
        edgeLogger.error('Error checking alerts', alertError);
      }
      
      return new Response(
        JSON.stringify(viosResult),
        { 
          headers: { ...corsHeaders, "Content-Type": "application/json" }, 
          status: viosResult.success ? 200 : 500 
        }
      );
    }

    // ==========================================
    // GENERIC HANDLER (existing logic)
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
          templateData.quantity = line.quantity;
          templateData.custom_sig = line.custom_sig;
          templateData.custom_dosage = line.custom_dosage;
          templateData.shipping_speed = line.shipping_speed;
          templateData.destination_state = line.destination_state;
          templateData.provider_name = line.providers?.profiles?.name;
          templateData.provider_npi = line.providers?.profiles?.npi;
          templateData.provider_dea = line.providers?.profiles?.dea;
        }
        
        payload = applyPayloadTemplate(pharmacy.api_payload_template, templateData);
        edgeLogger.info("Applied custom payload template");
      } catch (templateError) {
        edgeLogger.error("Failed to apply payload template, using default", templateError);
      }
    }

    // Build auth headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add custom headers if configured
    if (pharmacy.api_custom_headers && typeof pharmacy.api_custom_headers === 'object') {
      for (const [key, value] of Object.entries(pharmacy.api_custom_headers)) {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      }
    }

    // Add authentication headers
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

    // Use configured HTTP method (default to POST)
    const httpMethod = pharmacy.api_http_method || "POST";

    // Send with retry logic
    const maxRetries = pharmacy.api_retry_count || 3;
    const timeout = (pharmacy.api_timeout_seconds || 30) * 1000;
    let lastError: string = "";
    let responseStatus: number | null = null;
    let responseBody: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        edgeLogger.info("Attempting to send order to pharmacy", { 
          attempt: attempt + 1, 
          maxRetries, 
          endpoint: pharmacy.api_endpoint_url,
          method: httpMethod 
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(pharmacy.api_endpoint_url, {
          method: httpMethod,
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        responseStatus = response.status;

        // Read response body once
        const responseText = await response.text();
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = { text: responseText };
        }

        if (response.ok) {
          edgeLogger.info("Successfully sent batched order to pharmacy", { attempt: attempt + 1 });
          
          // Extract pharmacy order ID from response
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
            
            edgeLogger.info("Stored pharmacy order ID", { pharmacyOrderId, lineCount: unsent_lines.length });
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
            edgeLogger.error('Error checking alerts', alertError);
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
        edgeLogger.error('Pharmacy transmission attempt failed', error, { attempt: attempt + 1 });

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
      edgeLogger.error('Error checking alerts', alertError);
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Failed after ${maxRetries} attempts: ${lastError}` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );

  } catch (error) {
    edgeLogger.error('Error in send-order-to-pharmacy', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
