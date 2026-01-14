/**
 * VIOS API Type Definitions
 * Generated from: https://integrations.vioscompounding.com/swagger/v1/swagger.json
 * 
 * These types ensure compile-time safety and prevent payload drift.
 * If Swagger changes, TypeScript should fail the build.
 */

// ============= ENUMS (from Swagger) =============

/**
 * Order status values returned by VIOS API
 */
export enum ViosOrderStatus {
  Submitted = 'Submitted',
  InProgress = 'In Progress',
  Cancelled = 'Cancelled',
  Shipping = 'Shipping',
  Shipped = 'Shipped',
  Delivered = 'Delivered',
}

/**
 * Recipient type - determines where order is shipped
 */
export enum ViosRecipientType {
  Clinic = 'clinic',
  Patient = 'patient',
}

/**
 * Prescription type
 */
export enum ViosRxType {
  New = 'new',
  Refill = 'refill',
  Transfer = 'transfer',
}

/**
 * DEA Schedule codes for controlled substances
 */
export enum ViosScheduleCode {
  Schedule2 = '2',
  Schedule3 = '3',
  Schedule4 = '4',
  Schedule5 = '5',
  Legend = 'L',
  OTC = 'O',
}

/**
 * Patient gender values accepted by VIOS
 */
export enum ViosGender {
  Male = 'male',
  Female = 'female',
  Unknown = 'unknown',
}

/**
 * Environment for VIOS API calls
 */
export type ViosEnvironment = 'sandbox' | 'production';

// ============= REQUEST/RESPONSE INTERFACES =============

/**
 * VIOS API configuration
 */
export interface ViosConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  environment: ViosEnvironment;
}

/**
 * Token response from /api/auth/token
 */
export interface ViosTokenResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
}

/**
 * Patient information for order creation
 * @swagger /api/orders POST - patient object
 */
export interface ViosPatientModel {
  /** Patient first name - maxLength: 50 */
  firstName: string;
  /** Patient last name - maxLength: 50 */
  lastName: string;
  /** Date of birth - format: yyyy-MM-dd */
  dateOfBirth: string;
  /** Gender - required */
  gender: ViosGender;
  /** Email address - maxLength: 100, optional */
  email?: string;
  /** Phone number - format: (XXX) XXX-XXXX, optional */
  phone?: string;
}

/**
 * Shipping address for order
 * @swagger /api/orders POST - shipping object
 */
export interface ViosShippingModel {
  /** Recipient name - maxLength: 100 */
  name: string;
  /** Street address line 1 - maxLength: 100 */
  address1: string;
  /** Street address line 2 - maxLength: 100, optional */
  address2?: string;
  /** City - maxLength: 50 */
  city: string;
  /** State code - exactly 2 characters */
  state: string;
  /** ZIP code - format: XXXXX or XXXXX-XXXX */
  zip: string;
  /** Phone number - format: (XXX) XXX-XXXX, optional */
  phone?: string;
  /** Special delivery instructions - maxLength: 500, optional */
  deliveryInstructions?: string;
}

/**
 * Prescriber/clinic information
 * @swagger /api/orders POST - prescriber object
 */
export interface ViosPrescriberModel {
  /** Clinic/practice name - maxLength: 100 */
  clinicName: string;
  /** Prescriber NPI - exactly 10 digits */
  npi: string;
  /** Prescriber DEA number - optional */
  dea?: string;
  /** State license number - optional */
  stateLicense?: string;
  /** Prescriber first name - maxLength: 50 */
  firstName: string;
  /** Prescriber last name - maxLength: 50 */
  lastName: string;
  /** Phone number - format: (XXX) XXX-XXXX */
  phone: string;
  /** Fax number - format: (XXX) XXX-XXXX, optional */
  fax?: string;
  /** Email address - optional */
  email?: string;
  /** Street address - maxLength: 100 */
  address1: string;
  /** Address line 2 - optional */
  address2?: string;
  /** City - maxLength: 50 */
  city: string;
  /** State code - exactly 2 characters */
  state: string;
  /** ZIP code */
  zip: string;
}

/**
 * Product/medication line item
 * @swagger /api/orders POST - products array item
 */
export interface ViosProductModel {
  /** VIOS catalog product ID or custom product identifier */
  productId?: string;
  /** Product name/description - maxLength: 200 */
  productName: string;
  /** Dosage/strength description - maxLength: 100 */
  dosage?: string;
  /** Quantity to dispense */
  quantity: number;
  /** Days supply */
  daysSupply?: number;
  /** Number of refills authorized - 0-11 */
  refills?: number;
  /** DEA schedule code */
  scheduleCode?: ViosScheduleCode;
  /** Sig/directions - maxLength: 500 */
  sig?: string;
  /** Additional notes - maxLength: 500 */
  notes?: string;
}

/**
 * Complete order creation request
 * @swagger POST /api/orders
 */
export interface ViosCreateOrderRequest {
  /** Recipient type - clinic or patient */
  recipientType: ViosRecipientType;
  /** Prescription type */
  rxType: ViosRxType;
  /** Patient information */
  patient: ViosPatientModel;
  /** Prescriber/clinic information */
  prescriber: ViosPrescriberModel;
  /** Shipping information */
  shipping: ViosShippingModel;
  /** Products/medications to order */
  products: ViosProductModel[];
  /** VIOS shipping service code */
  shippingServiceCode: number;
  /** External reference ID - maxLength: 50, optional */
  externalReferenceId?: string;
  /** Order notes - maxLength: 1000, optional */
  orderNotes?: string;
  /** Signature required on delivery - optional */
  signatureRequired?: boolean;
}

/**
 * Order creation response
 * @swagger POST /api/orders response
 */
export interface ViosCreateOrderResponse {
  /** VIOS order ID */
  orderId: string;
  /** Order status */
  status: ViosOrderStatus;
  /** Timestamp of creation */
  createdAt?: string;
  /** Any warnings or messages */
  messages?: string[];
}

/**
 * Refill order request
 * @swagger POST /api/orders/refill
 */
export interface ViosRefillOrderRequest {
  /** Original VIOS order ID to refill */
  originalOrderId: string;
  /** Updated shipping if different */
  shipping?: ViosShippingModel;
  /** Updated shipping service code if different */
  shippingServiceCode?: number;
  /** Notes for refill */
  notes?: string;
}

/**
 * Order details response
 * @swagger GET /api/orders/{orderId}
 */
export interface ViosOrderDetailsResponse {
  orderId: string;
  externalReferenceId?: string;
  status: ViosOrderStatus;
  recipientType: ViosRecipientType;
  patient: ViosPatientModel;
  prescriber: ViosPrescriberModel;
  shipping: ViosShippingModel;
  products: ViosProductModel[];
  trackingNumber?: string;
  trackingUrl?: string;
  carrier?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shipping update request
 * @swagger PUT /api/orders/{orderId}/shipping
 */
export interface ViosUpdateShippingRequest {
  shipping: ViosShippingModel;
  shippingServiceCode?: number;
}

/**
 * Cancel order request
 * @swagger DELETE /api/orders/{orderId}
 */
export interface ViosCancelOrderRequest {
  reason?: string;
}

// ============= ERROR TYPES =============

/**
 * VIOS API error response structure
 */
export interface ViosErrorResponse {
  type?: string;
  title?: string;
  status: number;
  traceId?: string;
  errors?: ViosValidationError[];
  message?: string;
  Message?: string;
}

/**
 * Field-level validation error
 */
export interface ViosValidationError {
  field?: string;
  message: string;
  Message?: string;
}

/**
 * Mapped error types for application handling
 */
export enum ViosErrorType {
  AuthenticationError = 'AUTHENTICATION_ERROR',
  ValidationError = 'VALIDATION_ERROR',
  PermissionError = 'PERMISSION_ERROR',
  NotFoundError = 'NOT_FOUND_ERROR',
  SchemaError = 'SCHEMA_ERROR',
  ServerError = 'SERVER_ERROR',
  NetworkError = 'NETWORK_ERROR',
  UnknownError = 'UNKNOWN_ERROR',
}

/**
 * Structured error for application use
 */
export interface ViosError {
  type: ViosErrorType;
  message: string;
  statusCode?: number;
  details?: any;
  traceId?: string;
}

// ============= SHIPPING SERVICE CODES =============

/**
 * Common VIOS shipping service codes
 * Values may vary - check VIOS catalog for current codes
 */
export const VIOS_SHIPPING_CODES = {
  GROUND: 1,
  TWO_DAY: 2,
  OVERNIGHT: 3,
  PRIORITY_OVERNIGHT: 4,
  SATURDAY_DELIVERY: 5,
} as const;

// ============= VALIDATION HELPERS =============

/**
 * Validate NPI format (10 digits)
 */
export function isValidNPI(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

/**
 * Validate state code (2 uppercase letters)
 */
export function isValidStateCode(state: string): boolean {
  return /^[A-Z]{2}$/.test(state);
}

/**
 * Validate ZIP code (5 or 9 digits)
 */
export function isValidZipCode(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

/**
 * Validate phone format for VIOS: (XXX) XXX-XXXX
 */
export function isValidViosPhone(phone: string): boolean {
  return /^\(\d{3}\) \d{3}-\d{4}$/.test(phone);
}

/**
 * Validate date format for VIOS: yyyy-MM-dd
 */
export function isValidViosDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}
