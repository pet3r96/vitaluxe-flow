/**
 * VIOS API Type Definitions
 * 
 * Type-safe interfaces for VIOS Compounding API integration.
 * Based on VIOS OpenAPI spec at https://integrations.vioscompounding.com/swagger/v1/swagger.json
 */

// ============= Authentication =============

export interface ViosTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

// ============= Order Submission =============

export interface ViosOrderPayload {
  general: ViosOrderGeneral;
  document?: ViosOrderDocument;
  prescriber: ViosPrescriber;
  patient: ViosPatient;
  shipping: ViosShipping;
  rxs: ViosRxItem[];
}

export interface ViosOrderGeneral {
  memo?: string;                    // maxLength: 120
  referenceId?: string;             // maxLength: 200 - our order_line.id
  isTestOrder?: boolean;
  masterOrderLinkRequest?: number;
  masterOrderLinkScope?: 'Billing' | 'Shipping' | 'All';
}

export interface ViosOrderDocument {
  pdfBase64?: string;
}

export interface ViosPatient {
  lastName: string;                 // required, maxLength: 30
  firstName: string;                // required, maxLength: 30
  middleName?: string;
  gender: 'm' | 'f' | 'a' | 'u';    // required
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
  stateIssuedId?: string;
  driverLicenseNumber?: string;
  driverLicenseState?: string;
  socialSecurityNumber?: string;
  allergies?: number[];             // VIOS allergy codes
  allergiesRaw?: string[];          // Custom allergies
}

export interface ViosPrescriber {
  npi: string;                      // required
  lastName: string;                 // required
  firstName: string;                // required
  dea?: string;
  phone?: string;                   // pattern: (XXX) XXX-XXXX
  fax?: string;
}

export interface ViosShipping {
  service: number;                  // required - VIOS shipping code
  addressLine1: string;             // required, maxLength: 60
  addressLine2?: string;
  city: string;                     // required, maxLength: 30
  state: string;                    // required, 2-letter code
  zipCode: string;                  // required - NOTE: "zipCode" not "zip"
  recipientType?: 'clinic' | 'patient';
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  requireSignature?: boolean;
  saturdayDelivery?: boolean;
}

export interface ViosRxItem {
  rxType: 'new' | 'refill' | 'transfer';  // required
  quantity: string;                        // required - STRING not number!
  directions: string;                      // required - "directions" not "sig"
  lfProductId?: number;                    // VIOS product ID (preferred)
  drugName?: string;                       // Required if no lfProductId
  drugStrength?: string;
  drugForm?: string;
  quantityUnits?: string;
  foreignRxNumber?: string;                // Our reference for this rx
  clinicalDifferenceStatement?: string;    // REQUIRED for GLP-1 medications!
  specialInstructions?: string;
  scheduleCode?: '2' | '3' | '4' | '5' | 'L' | 'O';
  refills?: number;
  daysSupply?: number;
  dateWritten?: string;                    // pattern: yyyy-mm-dd
}

// ============= Order Response =============

export interface ViosOrderResponse {
  orderId?: number;
  orderLfId?: number;
  rxs?: Array<{
    rxLfId?: number;
    foreignRxNumber?: string;
  }>;
  // Legacy/alternate field names
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

// ============= Refill & Update =============

export interface ViosRefillOrderRequest {
  refilledReferenceId?: string;
  refilledLfOrderId?: number;
  refilledForeignRxNumber: string;
  newReferenceId?: string;
  newForeignRxNumber?: string;
}

export interface ViosUpdateShippingRequest {
  service: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  recipientType?: 'clinic' | 'patient';
  recipientFirstName?: string;
  recipientLastName?: string;
  recipientPhone?: string;
  requireSignature?: boolean;
  saturdayDelivery?: boolean;
}

// ============= Webhook Payload =============

export interface ViosWebhookPayload {
  pharmacyLocation?: string;
  fillId?: string;
  rxNumber: string;
  foreignRxNumber?: string;
  orderId: string;
  referenceId: string;
  practiceId?: string;
  providerId?: string;
  patientId?: string;
  lfdrugId?: string;
  rxStatus: string;
  rxStatusDateTime: string;
  deliveryService?: string;
  service?: string;
  trackingNumber?: string;
  shipAddressLine1?: string;
  shipAddressLine2?: string;
  shipAddressLine3?: string | null;
  shipCity?: string;
  shipState?: string;
  shipZip?: string;
  shipCountry?: string;
  shipCarrier?: string;
  drugName?: string;
}

// ============= Allergies =============

export interface ViosAllergy {
  name: string;
  code: number;
}

export interface ViosAllergyPagedResult {
  items: ViosAllergy[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============= API Health =============

export interface ViosConnectionStatus {
  connected: boolean;
  tokenValid: boolean;
  tokenExpiresIn?: number;
  lastSuccessfulCall?: string;
  error?: string;
}

// ============= Order Metadata =============

export interface ViosOrderMetadata {
  vios_order_id?: string | number;
  vios_rx_number?: string;
  vios_fill_id?: string;
  submitted_at: string;
  is_test_order: boolean;
  used_lf_product_id: boolean;
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
