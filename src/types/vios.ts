/**
 * VIOS API Type Definitions
 * 
 * Type-safe interfaces for VIOS Compounding API integration
 * Based on VIOS OpenAPI spec at https://integrations.vioscompounding.com/swagger/v1/swagger.json
 */

// ============= Authentication =============

export interface ViosTokenResponse {
  accessToken: string;      // VIOS returns camelCase
  tokenType?: string;
  expiresIn?: number;
}

// ============= Order Submission (Nested Structure per VIOS API) =============

/**
 * VIOS Order Payload - Nested structure per OpenAPI spec
 * Note: When lfProductId is provided, DrugName/DrugStrength/DrugForm/QuantityUnits become optional
 */
export interface ViosOrderPayload {
  general: ViosOrderGeneral;
  prescriber: ViosPrescriber;
  patient: ViosPatient;
  shipping: ViosShipping;
  rxs: ViosRxItem[];
}

export interface ViosOrderGeneral {
  isTestOrder: boolean;
  referenceId: string;
}

export interface ViosPatient {
  firstName: string;
  lastName: string;
  dateOfBirth: string;  // YYYY-MM-DD format
  gender: string;       // M/F/U
  phone: string;
  email?: string;
  allergyIds?: number[];
}

export interface ViosPrescriber {
  npi: string;
  firstName: string;
  lastName: string;
  dea?: string;
  phone: string;
}

export interface ViosShipping {
  service: number;      // VIOS shipping service code (required)
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zip: string;
}

export interface ViosRxItem {
  lfProductId?: string;           // Preferred - maps to VIOS catalog
  drugName?: string;              // Required if no lfProductId
  drugStrength?: string;          // Required if no lfProductId
  drugForm?: string;              // Required if no lfProductId
  quantity: number;               // CRITICAL: Must be in VOLUME (e.g., 5ml, not 1 vial)
  quantityUnits?: string;         // Required if no lfProductId
  sig: string;                    // Prescription instructions
  clinicalStatement?: string;     // REQUIRED for GLP-1 medications
  prescriptionPdfUrl?: string;
}

// ============= Order Response =============

export interface ViosOrderResponse {
  orderId?: string;
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

// ============= Shipping Codes (per VIOS documentation) =============

export const VIOS_SHIPPING_CODES = {
  FEDEX_2_DAY: 7608,
  USPS_PRIORITY: 7615,
  FEDEX_PRIORITY_OVERNIGHT: 7617,
  FEDEX_STANDARD_OVERNIGHT: 7618,
  FEDEX_OVERNIGHT_CALIFORNIA: 7620,
  FEDEX_GROUND: 7623,
} as const;

export type ViosShippingCode = typeof VIOS_SHIPPING_CODES[keyof typeof VIOS_SHIPPING_CODES];

// ============= Shipping Speed Mapping =============

export const SHIPPING_SPEED_TO_VIOS: Record<string, ViosShippingCode> = {
  'priority_overnight': VIOS_SHIPPING_CODES.FEDEX_PRIORITY_OVERNIGHT,
  'standard_overnight': VIOS_SHIPPING_CODES.FEDEX_STANDARD_OVERNIGHT,
  'overnight_california': VIOS_SHIPPING_CODES.FEDEX_OVERNIGHT_CALIFORNIA,
  '2_day': VIOS_SHIPPING_CODES.FEDEX_2_DAY,
  'ground': VIOS_SHIPPING_CODES.FEDEX_GROUND,
  'usps_priority': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'overnight': VIOS_SHIPPING_CODES.FEDEX_STANDARD_OVERNIGHT,
  'express': VIOS_SHIPPING_CODES.FEDEX_PRIORITY_OVERNIGHT,
  'standard': VIOS_SHIPPING_CODES.FEDEX_GROUND,
};

// ============= Allergy Types =============

export interface ViosAllergy {
  Code: number;
  Description: string;
}

// ============= Product Catalog =============

export interface ViosCatalogProduct {
  med_id: string;
  product_name: string;
  product_description?: string;
  product_form?: string;
  product_strength?: string;
  is_active?: boolean;
}

// ============= Order Metadata (stored in order_lines) =============

export interface ViosOrderMetadata {
  vios_order_id?: string;
  vios_rx_number?: string;
  vios_fill_id?: string;
  submitted_at: string;
  is_test_order: boolean;
  used_lf_product_id: boolean;
}

// ============= Webhook Payload (per VIOS documentation) =============
// Note: VIOS sends webhooks per prescription (rx), not per order
// Payload is always an array with exactly one item per prescription

export interface ViosWebhookPayload {
  pharmacyLocation?: string;
  fillId?: string;
  rxNumber: string;
  foreignRxNumber?: string;
  orderId: string;
  referenceId: string;          // Maps to our order_line_id
  practiceId?: string;
  providerId?: string;
  patientId?: string;
  lfdrugId?: string;
  rxStatus: string;             // Current status of the prescription
  rxStatusDateTime: string;     // When status changed
  deliveryService?: string;
  service?: string;
  trackingNumber?: string;
  shipAddressLine1?: string;
  shipAddressLine2?: string;
  shipAddressLine3?: string;
  shipCity?: string;
  shipState?: string;
  shipZip?: string;
  shipCountry?: string;
  shipCarrier?: string;
  drugName?: string;
}

// ============= Type Guards =============

export function isViosOrderResponse(obj: unknown): obj is ViosOrderResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    ('orderId' in obj || 'OrderId' in obj || 'status' in obj || 'Status' in obj)
  );
}

export function hasViosOrderId(response: ViosOrderResponse): boolean {
  return !!(response.orderId || response.OrderId);
}

export function getViosOrderId(response: ViosOrderResponse): string | undefined {
  return response.orderId || response.OrderId;
}

export function getViosRxNumber(response: ViosOrderResponse): string | undefined {
  return response.rxNumber || response.RxNumber;
}

// ============= Utility Functions =============

export function getViosShippingCode(shippingSpeed: string | null | undefined): ViosShippingCode {
  if (!shippingSpeed) return VIOS_SHIPPING_CODES.FEDEX_GROUND;
  
  const normalizedSpeed = shippingSpeed.toLowerCase().replace(/[-\s]/g, '_');
  return SHIPPING_SPEED_TO_VIOS[normalizedSpeed] || VIOS_SHIPPING_CODES.FEDEX_GROUND;
}

export function formatViosDateOfBirth(dob: string | Date | null | undefined): string {
  if (!dob) return '';
  
  if (typeof dob === 'string') {
    // Already in correct format
    if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return dob;
    }
    
    // Try to parse and reformat
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
 * Validate volume-based quantity per VIOS critical requirements
 * VIOS requires quantity in VOLUME (e.g., 5ml vial = quantity 5, 10, 15 ml)
 * NOT in count (e.g., 1, 2, 3 vials)
 */
export function validateVolumeQuantity(
  quantity: number, 
  productName: string
): { valid: boolean; warning?: string } {
  // Flag potential issues for vial products with suspiciously low quantities
  if (productName?.toLowerCase().includes('vial') && quantity <= 3) {
    return {
      valid: true,
      warning: `Low quantity (${quantity}) for vial product "${productName}" - verify this is in mL, not vial count`
    };
  }
  return { valid: true };
}

/**
 * Check if a product requires a clinical difference statement (GLP-1 medications)
 */
export function requiresClinicalStatement(productName: string): boolean {
  const glp1Keywords = [
    'semaglutide', 'tirzepatide', 'liraglutide', 'dulaglutide',
    'exenatide', 'glp-1', 'glp1', 'ozempic', 'wegovy', 'mounjaro',
    'saxenda', 'victoza', 'trulicity', 'byetta', 'bydureon'
  ];
  
  const lowerName = productName?.toLowerCase() || '';
  return glp1Keywords.some(keyword => lowerName.includes(keyword));
}
