/**
 * VIOS Order Validation
 * 
 * Pre-submission validation to ensure orders meet all VIOS requirements
 * before attempting API submission.
 */

import { edgeLogger } from '../logger.ts';
import { requiresGlp1Statement, getViosShippingCode, VIOS_SHIPPING_CODES } from './viosConfig.ts';
import type { ViosShippingCode } from './viosConfig.ts';

// ============= Validation Result Types =============

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface OrderLineData {
  id: string;
  patient_name?: string;
  patient_id?: string;
  quantity?: number;
  shipping_speed?: string;
  destination_state?: string;
  custom_sig?: string;
  custom_dosage?: string;
  patient_phone?: string;
  patient_email?: string;
  patient_address?: string;
  shipping_address?: string;
  products?: {
    id: string;
    name: string;
    vios_lf_product_id?: number | string | null;
    is_glp1?: boolean;
    glp1_clinical_statement?: string;
    product_types?: {
      is_glp?: boolean;
      glp_clinical_statement?: string;
    };
  };
  product_variants?: {
    id: string;
    dosage_label?: string;
    product_code?: string;
  };
  providers?: {
    user_id: string;
    profiles?: {
      name?: string;
      npi?: string;
      dea?: string;
      phone?: string;
    };
  };
  patient_accounts?: {
    first_name?: string;
    last_name?: string;
    date_of_birth?: string;
    birth_date?: string;
    gender_at_birth?: string;
    allergies?: string;
    allergy_codes?: number[];
    address_city?: string;
    address_state?: string;
    address_zip?: string;
    address_street?: string;
  };
}

export interface PracticeData {
  id: string;
  name?: string;
  npi?: string;
  dea?: string;
  phone?: string;
}

// ============= Validation Functions =============

/**
 * Format phone number to VIOS required format: (XXX) XXX-XXXX
 */
export function formatViosPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.slice(-10);
  
  if (last10.length !== 10) {
    return phone; // Return original if can't format
  }
  
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

/**
 * Format date of birth to YYYY-MM-DD format required by VIOS
 */
export function formatViosDateOfBirth(dob: string | Date | null | undefined): string {
  if (!dob) return '';
  
  if (typeof dob === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return dob;
    }
    const date = new Date(dob);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    return dob;
  }
  
  if (dob instanceof Date) {
    return dob.toISOString().split('T')[0];
  }
  
  return '';
}

/**
 * Validate NPI format (10 digits)
 */
export function validateNpi(npi: string | null | undefined): { valid: boolean; error?: string } {
  if (!npi) {
    return { valid: false, error: "NPI is required" };
  }
  
  const digitsOnly = npi.replace(/\D/g, '');
  
  if (digitsOnly.length !== 10) {
    return { valid: false, error: `NPI must be 10 digits, got ${digitsOnly.length}` };
  }
  
  return { valid: true };
}

/**
 * Validate US state code (2 letters)
 */
export function validateState(state: string | null | undefined): { valid: boolean; error?: string } {
  if (!state) {
    return { valid: false, error: "State is required" };
  }
  
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
  ];
  
  const normalized = state.toUpperCase().trim();
  
  if (!validStates.includes(normalized)) {
    return { valid: false, error: `Invalid state code: ${state}` };
  }
  
  return { valid: true };
}

/**
 * Validate shipping service code
 */
export function validateShippingService(
  shippingSpeed: string | null | undefined,
  customServiceCode?: number | null
): { valid: boolean; code: ViosShippingCode; error?: string } {
  // If custom code provided, validate it's a known VIOS code
  if (customServiceCode) {
    const validCodes = Object.values(VIOS_SHIPPING_CODES);
    if (!validCodes.includes(customServiceCode as ViosShippingCode)) {
      return { 
        valid: false, 
        code: VIOS_SHIPPING_CODES.FEDEX_GROUND,
        error: `Unknown VIOS shipping service code: ${customServiceCode}` 
      };
    }
    return { valid: true, code: customServiceCode as ViosShippingCode };
  }
  
  // Otherwise derive from shipping speed
  const code = getViosShippingCode(shippingSpeed);
  return { valid: true, code };
}

/**
 * Validate volume-based quantity
 * VIOS requires quantity in VOLUME (e.g., 5ml vial = 5), not vial count
 */
export function validateVolumeQuantity(
  quantity: number | null | undefined,
  productName: string
): { valid: boolean; warning?: string; error?: string } {
  if (!quantity || quantity <= 0) {
    return { valid: false, error: "Quantity is required and must be positive" };
  }
  
  // Flag potential issues for vial products with suspiciously low quantities
  if (productName?.toLowerCase().includes('vial') && quantity <= 3) {
    return {
      valid: true,
      warning: `Low quantity (${quantity}) for vial product - verify this is in mL, not vial count`
    };
  }
  
  return { valid: true };
}

/**
 * Validate GLP-1 clinical difference statement requirement
 */
export function validateGlp1Statement(
  productName: string,
  clinicalStatement: string | null | undefined,
  isGlp1Flag?: boolean
): { valid: boolean; error?: string } {
  const isGlp1 = isGlp1Flag || requiresGlp1Statement(productName);
  
  if (isGlp1 && !clinicalStatement) {
    return { 
      valid: false, 
      error: `GLP-1 medication "${productName}" requires a clinical difference statement` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate patient data completeness
 */
export function validatePatientData(patient: OrderLineData['patient_accounts']): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!patient) {
    return { valid: false, errors: ["Patient data is required"], warnings: [] };
  }
  
  if (!patient.first_name) errors.push("Patient first name is required");
  if (!patient.last_name) errors.push("Patient last name is required");
  
  const dob = patient.date_of_birth || patient.birth_date;
  if (!dob) {
    errors.push("Patient date of birth is required");
  }
  
  if (!patient.gender_at_birth) {
    warnings.push("Patient gender not specified, will default to 'u' (unknown)");
  }
  
  // Address validation
  if (!patient.address_state) errors.push("Patient state is required");
  if (!patient.address_city) errors.push("Patient city is required");
  if (!patient.address_zip) errors.push("Patient ZIP code is required");
  if (!patient.address_street) warnings.push("Patient street address not provided");
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate prescriber data
 */
export function validatePrescriberData(
  provider: OrderLineData['providers'],
  practice: PracticeData | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Get NPI from provider or practice
  const npi = provider?.profiles?.npi || practice?.npi;
  
  const npiValidation = validateNpi(npi);
  if (!npiValidation.valid) {
    errors.push(npiValidation.error!);
  }
  
  // Check for name
  const prescriberName = provider?.profiles?.name;
  if (!prescriberName) {
    errors.push("Prescriber name is required");
  }
  
  // Phone is optional but recommended
  if (!provider?.profiles?.phone && !practice?.phone) {
    warnings.push("Prescriber phone not provided");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Full order line validation for VIOS submission
 */
export function validateOrderLineForVios(
  orderLine: OrderLineData,
  practice: PracticeData | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // 1. Validate product has VIOS ID
  const viosProductId = orderLine.products?.vios_lf_product_id;
  if (!viosProductId) {
    errors.push(`Product "${orderLine.products?.name || 'Unknown'}" is not mapped to a VIOS product ID`);
  }
  
  // 2. Validate quantity
  const qtyValidation = validateVolumeQuantity(
    orderLine.quantity,
    orderLine.products?.name || ''
  );
  if (!qtyValidation.valid) errors.push(qtyValidation.error!);
  if (qtyValidation.warning) warnings.push(qtyValidation.warning);
  
  // 3. Validate GLP-1 statement if needed
  const isGlp1 = orderLine.products?.is_glp1 || 
    orderLine.products?.product_types?.is_glp ||
    requiresGlp1Statement(orderLine.products?.name || '');
  
  const clinicalStatement = orderLine.products?.glp1_clinical_statement ||
    orderLine.products?.product_types?.glp_clinical_statement;
  
  if (isGlp1 && !clinicalStatement) {
    errors.push(`GLP-1 product requires clinical difference statement`);
  }
  
  // 4. Validate prescriber
  const prescriberValidation = validatePrescriberData(orderLine.providers, practice);
  errors.push(...prescriberValidation.errors);
  warnings.push(...prescriberValidation.warnings);
  
  // 5. Validate patient
  const patientValidation = validatePatientData(orderLine.patient_accounts);
  errors.push(...patientValidation.errors);
  warnings.push(...patientValidation.warnings);
  
  // 6. Validate shipping
  const shippingValidation = validateShippingService(orderLine.shipping_speed);
  if (!shippingValidation.valid) errors.push(shippingValidation.error!);
  
  // 7. Validate directions/sig
  if (!orderLine.custom_sig && !orderLine.custom_dosage) {
    errors.push("Directions (sig) are required for VIOS orders");
  }
  
  // Log validation result
  if (errors.length > 0) {
    edgeLogger.warn("VIOS order validation failed", { 
      orderLineId: orderLine.id, 
      errorCount: errors.length,
      errors 
    });
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}
