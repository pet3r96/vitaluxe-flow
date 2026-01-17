/**
 * VIOS API Type Definitions
 * 
 * Type-safe interfaces for VIOS Compounding API integration
 */

// ============= Authentication =============

export interface ViosTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ============= Order Submission =============

export interface ViosOrderPayload {
  IsTestOrder: boolean;
  ReferenceId: string;
  lfProductId?: string;
  DrugName?: string;
  DrugStrength?: string;
  DrugForm?: string;
  Quantity: number;
  QuantityUnits?: string;
  Sig: string;
  ClinicalStatement?: string;
  Patient: ViosPatient;
  Prescriber: ViosPrescriber;
  Shipping: ViosShipping;
  PrescriptionPdfUrl?: string;
}

export interface ViosPatient {
  FirstName: string;
  LastName: string;
  DateOfBirth: string; // YYYY-MM-DD format
  Gender: string; // M/F/U
  Phone: string;
  Email?: string;
  AllergyIds?: number[];
}

export interface ViosPrescriber {
  NPI: string;
  FirstName: string;
  LastName: string;
  DEA?: string;
  Phone: string;
}

export interface ViosShipping {
  Service: number;
  AddressLine1: string;
  AddressLine2?: string;
  City: string;
  State: string;
  Zip: string;
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

// ============= Shipping Codes =============

export const VIOS_SHIPPING_CODES = {
  FEDEX_PRIORITY_OVERNIGHT: 7617,
  FEDEX_STANDARD_OVERNIGHT: 7618,
  FEDEX_OVERNIGHT_CALIFORNIA: 7620,
  FEDEX_2_DAY: 7608,
  FEDEX_GROUND: 7623,
  USPS_PRIORITY: 7615,
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

// ============= Order Metadata =============

export interface ViosOrderMetadata {
  vios_order_id?: string;
  vios_rx_number?: string;
  vios_fill_id?: string;
  submitted_at: string;
  is_test_order: boolean;
  used_lf_product_id: boolean;
}

// ============= Webhook Types =============

export interface ViosWebhookPayload {
  event: string;
  orderId: string;
  rxNumber?: string;
  status?: string;
  trackingNumber?: string;
  carrier?: string;
  shipDate?: string;
  estimatedDelivery?: string;
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
