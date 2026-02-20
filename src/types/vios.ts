/**
 * VIOS API Type Definitions
 * 
 * Type-safe interfaces for VIOS Compounding API integration
 * Based on VIOS OpenAPI spec at https://integrations.vioscompounding.com/swagger/v1/swagger.json
 * 
 * CRITICAL REQUIREMENTS PER VIOS DOCS:
 * 1. Quantity MUST be passed in VOLUME (e.g., 5ml vial = 5, not 1 vial)
 * 2. GLP-1 medications REQUIRE clinicalDifferenceStatement
 * 3. When lfProductId provided, DrugName/DrugStrength/DrugForm/QuantityUnits optional
 * 4. rxType is REQUIRED for all rxs
 * 5. Phone format: (XXX) XXX-XXXX
 */

// ============= Authentication =============

export interface ViosTokenResponse {
  accessToken: string;      // VIOS returns camelCase
  tokenType?: string;
  expiresIn?: number;
}

// ============= Order Submission (per VIOS OpenAPI Spec) =============

/**
 * VIOS Order Payload - Nested structure per OpenAPI spec
 * Reference: CreateOrderRequest schema
 */
export interface ViosOrderPayload {
  general: ViosOrderGeneral;
  document?: ViosOrderDocument;
  prescriber: ViosPrescriber;
  patient: ViosPatient;
  shipping: ViosShipping;
  rxs: ViosRxItem[];
}

/**
 * General order info - CreateOrderRequestGeneralModel
 */
export interface ViosOrderGeneral {
  memo?: string;                    // maxLength: 120
  referenceId?: string;             // maxLength: 200 - our order_line.id
  isTestOrder?: boolean;
  // Note: practiceId is NOT in VIOS OpenAPI CreateOrderRequestGeneralModel
  // Practice is determined server-side by the API credentials (ClientId/ClientSecret)
  masterOrderLinkRequest?: number;
  masterOrderLinkScope?: 'Billing' | 'Shipping' | 'All';
  fax?: ViosFaxInfo;
}

export interface ViosFaxInfo {
  ani?: string;
  csid?: string;
  did?: string;
}

/**
 * Document model - for PDF prescriptions
 * CreateOrderRequestDocumentModel
 */
export interface ViosOrderDocument {
  pdfBase64?: string;  // Required for controlled substances
}

/**
 * Patient model - CreateOrderRequestPatientModel
 */
export interface ViosPatient {
  lastName: string;                 // required, maxLength: 30
  firstName: string;                // required, maxLength: 30
  middleName?: string;
  gender: 'm' | 'f' | 'a' | 'u';    // required - Gender enum
  dateOfBirth: string;              // required, pattern: yyyy-mm-dd
  address1?: string;                // maxLength: 60
  address2?: string;
  address3?: string;
  city?: string;                    // maxLength: 30
  state?: string;                   // 2-letter code
  zip?: string;
  phoneHome?: string;               // pattern: (XXX) XXX-XXXX
  phoneMobile?: string;
  phoneWork?: string;
  email?: string;
  // For controlled substances:
  stateIssuedId?: string;
  driverLicenseNumber?: string;     // pattern: ^[a-zA-Z0-9]{1,20}$
  driverLicenseState?: string;
  socialSecurityNumber?: string;
  // Allergies
  allergies?: number[];             // VIOS allergy codes from /api/allergies
  allergiesRaw?: string[];          // Custom allergies (may slow processing)
}

/**
 * Prescriber model - CreateOrderRequestPrescriberModel
 */
export interface ViosPrescriber {
  npi: string;                      // required
  lastName: string;                 // required
  firstName: string;                // required
  dea?: string;
  phone?: string;                   // pattern: (XXX) XXX-XXXX
  fax?: string;
}

/**
 * Shipping model - CreateOrderRequestShippingModel
 */
export interface ViosShipping {
  service: number;                  // required - VIOS shipping code
  addressLine1: string;             // required, maxLength: 60
  addressLine2?: string;
  city: string;                     // required, maxLength: 30
  state: string;                    // required, 2-letter code
  zipCode: string;                  // required - NOTE: "zipCode" not "zip"
  recipientType?: 'clinic' | 'patient';  // RecipientType enum
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  requireSignature?: boolean;
  saturdayDelivery?: boolean;
}

/**
 * Rx item model - CreateOrderRequestRxModel
 */
export interface ViosRxItem {
  rxType: 'new' | 'refill' | 'transfer';  // required - RxType enum
  quantity: string;                        // required - NOTE: STRING not number!
  directions: string;                      // required - NOTE: "directions" not "sig"
  lfProductId?: number;                    // integer - VIOS product ID (preferred)
  drugName?: string;                       // Required if no lfProductId
  drugStrength?: string;
  drugForm?: string;
  quantityUnits?: string;
  foreignRxNumber?: string;                // Our reference for this rx
  clinicalDifferenceStatement?: string;    // REQUIRED for GLP-1 medications!
  specialInstructions?: string;
  scheduleCode?: '2' | '3' | '4' | '5' | 'L' | 'O';  // ScheduleCode enum
  refills?: number;
  daysSupply?: number;
  dateWritten?: string;                    // pattern: yyyy-mm-dd
}

// ============= Order Response - CreateOrderResponse =============

export interface ViosOrderResponse {
  orderId?: number;
  orderLfId?: number;
  rxs?: Array<{
    rxLfId?: number;
    foreignRxNumber?: string;
  }>;
  // Also handle legacy/alternate field names
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

// ============= Refill Order - RefillOrderRequest =============

export interface ViosRefillOrderRequest {
  refilledReferenceId?: string;     // Our order reference OR...
  refilledLfOrderId?: number;       // VIOS order ID
  refilledForeignRxNumber: string;  // required - original rx reference
  newReferenceId?: string;          // New order reference
  newForeignRxNumber?: string;      // New rx reference
}

// ============= Update Shipping - OrderShippingModel =============

export interface ViosUpdateShippingRequest {
  service: number;                  // required
  addressLine1: string;             // required
  addressLine2?: string;
  city: string;                     // required
  state: string;                    // required
  zipCode: string;                  // required
  recipientType?: 'clinic' | 'patient';
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  requireSignature?: boolean;
  saturdayDelivery?: boolean;
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
  'usps_priority': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'overnight': VIOS_SHIPPING_CODES.FEDEX_STANDARD_OVERNIGHT,
  'express': VIOS_SHIPPING_CODES.FEDEX_PRIORITY_OVERNIGHT,
  '2day': VIOS_SHIPPING_CODES.FEDEX_2_DAY,
  'priority': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'first_class': VIOS_SHIPPING_CODES.USPS_PRIORITY,
  'ground': VIOS_SHIPPING_CODES.FEDEX_GROUND, // historical
  'standard': VIOS_SHIPPING_CODES.FEDEX_GROUND, // historical
};

// ============= Allergy Types (from /api/allergies - AllergyPagedResult) =============

export interface ViosAllergyPagedResult {
  items: ViosAllergy[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ViosAllergy {
  name: string;       // Allergy name
  code: number;       // VIOS allergy code to use in orders
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

// ============= Order Metadata (stored in order_lines.pharmacy_order_metadata) =============

export interface ViosOrderMetadata {
  vios_order_id?: string | number;
  vios_rx_number?: string;
  vios_fill_id?: string;
  submitted_at: string;
  is_test_order: boolean;
  used_lf_product_id: boolean;
}

// ============= Webhook Payload (per VIOS Integration Portal) =============
/**
 * VIOS Webhook Payload
 * 
 * IMPORTANT: Webhooks are sent per prescription (rx), not per order.
 * Each webhook contains an array with exactly one item.
 * If an order contains multiple prescriptions and they both get shipped,
 * you will receive SEPARATE webhook notifications for each prescription.
 * 
 * Example payload from VIOS documentation:
 * [
 *   {
 *     "pharmacyLocation": "vioscompounding",
 *     "fillId": "100482",
 *     "rxNumber": "66692847",
 *     "foreignRxNumber": "rx_m8XvL9NdWpR2eTfk",
 *     "orderId": "7771349652",
 *     "referenceId": "rx_n5QwP7BkJmX4rYuL",
 *     "practiceId": "11157",
 *     "providerId": "208591473",
 *     "patientId": "208742695",
 *     "lfdrugId": "305896241",
 *     "rxStatus": "Shipping",
 *     "rxStatusDateTime": "2025-12-12T15:42:33",
 *     "deliveryService": "UPS Ground",
 *     "service": "Ground",
 *     "trackingNumber": "1Z999AA1234567890",
 *     "shipAddressLine1": "123 Main Street",
 *     "shipAddressLine2": "Suite 200",
 *     "shipAddressLine3": null,
 *     "shipCity": "Austin",
 *     "shipState": "TX",
 *     "shipZip": "78701",
 *     "shipCountry": "US",
 *     "shipCarrier": "UPS",
 *     "drugName": "Semaglutide/Methylcobalamin/Glycine (1ml)"
 *   }
 * ]
 */
export interface ViosWebhookPayload {
  pharmacyLocation?: string;        // "vioscompounding"
  fillId?: string;                  // "100482"
  rxNumber: string;                 // "66692847"
  foreignRxNumber?: string;         // Our rx reference (from foreignRxNumber in order)
  orderId: string;                  // VIOS order ID "7771349652"
  referenceId: string;              // Our order_line.id (from referenceId in order)
  practiceId?: string;              // "11157"
  providerId?: string;              // "208591473"
  patientId?: string;               // "208742695"
  lfdrugId?: string;                // "305896241"
  rxStatus: string;                 // "Shipping", "Delivered", etc.
  rxStatusDateTime: string;         // "2025-12-12T15:42:33"
  deliveryService?: string;         // "UPS Ground" - full delivery service name
  service?: string;                 // "Ground" - service type only
  trackingNumber?: string;          // "1Z999AA1234567890"
  shipAddressLine1?: string;        // "123 Main Street"
  shipAddressLine2?: string;        // "Suite 200"
  shipAddressLine3?: string | null; // Can be null
  shipCity?: string;                // "Austin"
  shipState?: string;               // "TX"
  shipZip?: string;                 // "78701"
  shipCountry?: string;             // "US"
  shipCarrier?: string;             // "UPS"
  drugName?: string;                // "Semaglutide/Methylcobalamin/Glycine (1ml)"
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
  if (response.orderId) return String(response.orderId);
  if (response.OrderId) return response.OrderId;
  return undefined;
}

export function getViosRxNumber(response: ViosOrderResponse): string | undefined {
  return response.rxNumber || response.RxNumber;
}

// ============= Utility Functions =============

/**
 * Get VIOS shipping service code from shipping speed string
 */
export function getViosShippingCode(shippingSpeed: string | null | undefined): ViosShippingCode {
  if (!shippingSpeed) return VIOS_SHIPPING_CODES.USPS_PRIORITY;
  
  const normalizedSpeed = shippingSpeed.toLowerCase().replace(/[-\s]/g, '_');
  return SHIPPING_SPEED_TO_VIOS[normalizedSpeed] || VIOS_SHIPPING_CODES.USPS_PRIORITY;
}

/**
 * Format date of birth to YYYY-MM-DD format required by VIOS
 */
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
 * Format phone number to VIOS required format: (XXX) XXX-XXXX
 */
export function formatViosPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // Extract digits only
  const digits = phone.replace(/\D/g, '');
  
  // Get last 10 digits (handles +1 prefix)
  const last10 = digits.slice(-10);
  
  if (last10.length !== 10) {
    // Return original if can't format
    return phone;
  }
  
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
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
 * Per VIOS: "Clinical difference statement is required for all GLP-1s"
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
