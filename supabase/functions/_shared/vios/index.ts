/**
 * VIOS Integration Module
 * 
 * Unified exports for VIOS Compounding API integration.
 * All VIOS-related functionality should be imported from this module.
 */

// Configuration
export {
  VIOS_ENABLED,
  VIOS_API_URL,
  VIOS_SHIPPING_CODES,
  VIOS_PHARMACY_IDENTIFIERS,
  isViosPharmacy,
  getViosShippingCode,
  requiresGlp1Statement,
  type ViosShippingCode
} from './viosConfig.ts';

// API Client
export {
  isViosEnabled,
  getViosToken,
  clearViosTokenCache,
  getViosConnectionStatus,
  viosApiRequest,
  throttledViosApiRequest
} from './viosClient.ts';

// Types
export type {
  ViosTokenResponse,
  ViosOrderPayload,
  ViosOrderGeneral,
  ViosOrderDocument,
  ViosPatient,
  ViosPrescriber,
  ViosShipping,
  ViosRxItem,
  ViosOrderResponse,
  ViosRefillOrderRequest,
  ViosUpdateShippingRequest,
  ViosWebhookPayload,
  ViosAllergy,
  ViosAllergyPagedResult,
  ViosConnectionStatus,
  ViosOrderMetadata
} from './viosTypes.ts';

export {
  isViosOrderResponse,
  hasViosOrderId,
  getViosOrderId,
  getViosRxNumber
} from './viosTypes.ts';

// Validation
export {
  formatViosPhone,
  formatViosDateOfBirth,
  validateNpi,
  validateState,
  validateShippingService,
  validateVolumeQuantity,
  validateGlp1Statement,
  validatePatientData,
  validatePrescriberData,
  validateOrderLineForVios,
  isControlledSubstance,
  type ValidationResult,
  type OrderLineData,
  type PracticeData
} from './viosValidation.ts';

// Order Submission
export {
  buildViosOrderPayload,
  submitViosOrder,
  submitViosRefill,
  type SubmitOrderResult
} from './viosOrders.ts';
