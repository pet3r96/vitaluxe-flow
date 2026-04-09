/**
 * VIOS Order Submission
 * 
 * Builds and submits orders to VIOS API following their OpenAPI specification.
 */

import { edgeLogger } from '../logger.ts';
import { throttledViosApiRequest } from './viosClient.ts';
import { getViosShippingCode, requiresGlp1Statement } from './viosConfig.ts';
import { 
  formatViosPhone, 
  formatViosDateOfBirth, 
  validateOrderLineForVios,
  type OrderLineData,
  type PracticeData 
} from './viosValidation.ts';
import type { 
  ViosOrderPayload, 
  ViosOrderResponse,
  ViosOrderMetadata,
  ViosRefillOrderRequest 
} from './viosTypes.ts';
import { getViosOrderId, getViosRxNumber } from './viosTypes.ts';

// ============= Payload Building =============

/**
 * Map gender to VIOS format
 */
function mapGender(gender: string | null | undefined): 'm' | 'f' | 'a' | 'u' {
  if (!gender) return 'u';
  const normalized = gender.toLowerCase().trim();
  if (normalized === 'm' || normalized === 'male') return 'm';
  if (normalized === 'f' || normalized === 'female') return 'f';
  if (normalized === 'a' || normalized === 'other') return 'a';
  return 'u';
}

/**
 * Parse patient name into first and last
 */
function parsePatientName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: 'Unknown', lastName: 'Patient' };
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Unknown' };
  }
  
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

/**
 * Parse prescriber name into first and last
 */
function parsePrescriberName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: 'Unknown', lastName: 'Prescriber' };
  
  // Remove common prefixes
  let cleaned = fullName.replace(/^(Dr\.?|MD|DO|NP|PA)\s*/i, '').trim();
  
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Unknown' };
  }
  
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

/**
 * Parse address components from formatted address string
 */
function parseAddress(address: string | null | undefined): {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
} {
  if (!address) {
    return { line1: '', city: '', state: '', zip: '' };
  }
  
  // Try to parse "Street, City, State ZIP" format
  const parts = address.split(',').map(p => p.trim());
  
  if (parts.length >= 3) {
    const lastPart = parts[parts.length - 1];
    const stateZipMatch = lastPart.match(/([A-Z]{2})\s*(\d{5}(-\d{4})?)?/i);
    
    if (stateZipMatch) {
      return {
        line1: parts[0],
        line2: parts.length > 3 ? parts[1] : undefined,
        city: parts[parts.length - 2],
        state: stateZipMatch[1].toUpperCase(),
        zip: stateZipMatch[2] || ''
      };
    }
  }
  
  // Fallback: return as line1
  return { line1: address, city: '', state: '', zip: '' };
}

/**
 * Build VIOS order payload from order line data
 */
export function buildViosOrderPayload(
  orderLine: OrderLineData,
  practice: PracticeData | null,
  options: {
    isTestOrder?: boolean;
    memo?: string;
    pdfBase64?: string | null;
  } = {}
): ViosOrderPayload {
  const { isTestOrder = false, memo, pdfBase64 } = options;
  
  // Get patient data
  const patient = orderLine.patient_accounts;
  const patientName = parsePatientName(orderLine.patient_name);
  const patientFirstName = patient?.first_name || patientName.firstName;
  const patientLastName = patient?.last_name || patientName.lastName;
  
  // Get patient DOB
  const dob = formatViosDateOfBirth(patient?.date_of_birth || patient?.birth_date);
  
  // Get prescriber data
  const provider = orderLine.providers;
  const prescriberName = parsePrescriberName(provider?.profiles?.name);
  const prescriberNpi = provider?.profiles?.npi || practice?.npi || '';
  
  // Get shipping address (use patient or shipping address)
  const shippingAddress = orderLine.shipping_address || orderLine.patient_address;
  const parsedShipping = parseAddress(shippingAddress);
  
  // Use structured patient address if available
  const shippingLine1 = patient?.address_street || parsedShipping.line1;
  const shippingSuite = (patient as any)?.address_suite || parsedShipping.line2 || '';
  const shippingCity = patient?.address_city || parsedShipping.city;
  const shippingState = patient?.address_state || parsedShipping.state;
  const shippingZip = patient?.address_zip || parsedShipping.zip;
  
  // Get VIOS product ID
  const viosProductId = orderLine.product_variants?.product_code
    || orderLine.products?.vios_lf_product_id;
  const productName = orderLine.products?.name || 'Unknown Product';
  
  // Build clinical statement for GLP-1
  const isGlp1 = orderLine.products?.is_glp1 || 
    orderLine.products?.product_types?.is_glp ||
    requiresGlp1Statement(productName);
  
  const clinicalStatement = orderLine.products?.glp1_clinical_statement ||
    orderLine.products?.product_types?.glp_clinical_statement;
  
  // Get allergies
  const allergyCodes = (patient as any)?.allergy_codes || [];
  const allergiesRaw = patient?.allergies ? [patient.allergies] : undefined;
  
  // Extract mL volume from dosage label for injectable Rx quantity
  const dosageLabel = orderLine.product_variants?.dosage_label || '';
  const mlMatch = dosageLabel.match(/[\-–]\s*(\d+)\s*mL/i);
  const rxQuantity = mlMatch ? parseInt(mlMatch[1]) : (orderLine.quantity || 1);

  const payload: ViosOrderPayload = {
    general: {
      referenceId: orderLine.id,
      isTestOrder,
      ...(memo && { memo: memo.substring(0, 120) })
    },
    // Include prescription PDF if provided
    ...(pdfBase64 && { document: { pdfBase64 } }),
    prescriber: {
      npi: prescriberNpi,
      firstName: prescriberName.firstName,
      lastName: prescriberName.lastName,
      phone: formatViosPhone(provider?.profiles?.phone || practice?.phone),
      ...(provider?.profiles?.dea && { dea: provider.profiles.dea })
    },
    patient: {
      firstName: patientFirstName,
      lastName: patientLastName,
      dateOfBirth: dob,
      gender: mapGender(patient?.gender_at_birth),
      address1: shippingLine1,
      ...(shippingSuite && { address2: shippingSuite }),
      city: shippingCity,
      state: shippingState,
      zip: shippingZip,
      phoneHome: formatViosPhone(orderLine.patient_phone),
      ...(orderLine.patient_email && { email: orderLine.patient_email }),
      ...(allergyCodes.length > 0 && { allergies: allergyCodes }),
      ...(allergiesRaw && { allergiesRaw })
    },
    shipping: {
      service: getViosShippingCode(orderLine.shipping_speed),
      addressLine1: shippingLine1,
      city: shippingCity,
      state: shippingState,
      zipCode: shippingZip,
      recipientType: 'patient',
      recipientFirstName: patientFirstName,
      recipientLastName: patientLastName,
      recipientPhone: formatViosPhone(orderLine.patient_phone)
    },
    rxs: [{
      rxType: 'new',
      quantity: String(rxQuantity),
      directions: orderLine.custom_sig || orderLine.custom_dosage || 'As directed',
      foreignRxNumber: orderLine.id,
      lfProductId: Number(viosProductId), // Required — validated upstream by product management
      ...(orderLine.days_supply && { daysSupply: Number(orderLine.days_supply) }),
      ...(isGlp1 && clinicalStatement && { clinicalDifferenceStatement: clinicalStatement })
    }]
  };
  
  return payload;
}

// ============= Order Submission =============

export interface SubmitOrderResult {
  success: boolean;
  orderId?: string;
  rxNumber?: string;
  response?: ViosOrderResponse;
  error?: string;
  metadata?: ViosOrderMetadata;
}

/**
 * Submit an order to VIOS API
 */
export async function submitViosOrder(
  orderLine: OrderLineData,
  practice: PracticeData | null,
  options: {
    isTestOrder?: boolean;
    memo?: string;
    skipValidation?: boolean;
    pdfBase64?: string | null;
  } = {}
): Promise<SubmitOrderResult> {
  const { isTestOrder = false, memo, skipValidation = false, pdfBase64 } = options;
  
  // Validate order line before submission
  if (!skipValidation) {
    const validation = validateOrderLineForVios(orderLine, practice);
    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`
      };
    }
    
    if (validation.warnings.length > 0) {
      edgeLogger.warn("VIOS order validation warnings", { 
        orderLineId: orderLine.id,
        warnings: validation.warnings 
      });
    }
  }
  
  try {
    // Build payload with optional PDF
    const payload = buildViosOrderPayload(orderLine, practice, { isTestOrder, memo, pdfBase64 });
    
    edgeLogger.info("Submitting order to VIOS", { 
      orderLineId: orderLine.id,
      isTestOrder,
      hasLfProductId: !!payload.rxs[0]?.lfProductId
    });
    
    // Submit to VIOS
    const response = await throttledViosApiRequest<ViosOrderResponse>('/api/orders', {
      method: 'POST',
      body: payload
    });
    
    const orderId = getViosOrderId(response);
    const rxNumber = getViosRxNumber(response);
    
    if (orderId) {
      edgeLogger.info("VIOS order submitted successfully", { 
        orderLineId: orderLine.id,
        viosOrderId: orderId,
        rxNumber
      });
      
      return {
        success: true,
        orderId,
        rxNumber,
        response,
        metadata: {
          vios_order_id: orderId,
          vios_rx_number: rxNumber,
          submitted_at: new Date().toISOString(),
          is_test_order: isTestOrder,
          used_lf_product_id: !!payload.rxs[0]?.lfProductId
        }
      };
    } else {
      // Response received but no order ID
      const errorMessage = response.message || response.Message || 
        response.errors?.join(', ') || response.Errors?.join(', ') ||
        'Order submitted but no order ID returned';
      
      edgeLogger.error("VIOS order submission failed", new Error(errorMessage), {
        orderLineId: orderLine.id,
        response
      });
      
      return {
        success: false,
        error: errorMessage,
        response
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    edgeLogger.error("VIOS order submission error", error instanceof Error ? error : new Error(errorMessage), {
      orderLineId: orderLine.id
    });
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Submit a refill order to VIOS API
 */
export async function submitViosRefill(
  originalOrderLineId: string,
  originalViosOrderId: string,
  newOrderLineId: string
): Promise<SubmitOrderResult> {
  try {
    const refillRequest: ViosRefillOrderRequest = {
      refilledReferenceId: originalOrderLineId,
      refilledForeignRxNumber: originalOrderLineId,
      newReferenceId: newOrderLineId,
      newForeignRxNumber: newOrderLineId
    };
    
    edgeLogger.info("Submitting refill to VIOS", { 
      originalOrderLineId,
      originalViosOrderId,
      newOrderLineId
    });
    
    const response = await throttledViosApiRequest<ViosOrderResponse>('/api/orders/refill', {
      method: 'POST',
      body: refillRequest
    });
    
    const orderId = getViosOrderId(response);
    
    if (orderId) {
      return {
        success: true,
        orderId,
        response,
        metadata: {
          vios_order_id: orderId,
          submitted_at: new Date().toISOString(),
          is_test_order: false,
          used_lf_product_id: true
        }
      };
    }
    
    return {
      success: false,
      error: response.message || 'Refill submitted but no order ID returned',
      response
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    edgeLogger.error("VIOS refill submission error", error instanceof Error ? error : new Error(errorMessage), {
      originalOrderLineId,
      newOrderLineId
    });
    
    return {
      success: false,
      error: errorMessage
    };
  }
}
