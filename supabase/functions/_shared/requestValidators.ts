/**
 * Request validation schemas for edge functions
 * Provides centralized validation for all API endpoints
 */

import { 
  validateUUID, 
  validateEmail, 
  validateString, 
  validateBoolean,
  validateEnum,
  validateIP,
  validateNumber,
  validateArray,
  validateInput,
  validatePhone,
  validateNPI,
  validateDEA
} from './validators.ts';

export function validateCancelOrderRequest(data: any) {
  const validations = [
    validateUUID(data.orderId, 'orderId'),
    validateString(data.reason, 'reason', { maxLength: 500 })
  ];
  
  return validateInput(validations);
}

export function validateTrackFailedLoginRequest(data: any) {
  const validations = [
    validateEmail(data.email),
    validateIP(data.ip_address),
    validateString(data.user_agent, 'user_agent', { maxLength: 500 })
  ];
  
  return validateInput(validations);
}

export function validateDetectBruteForceRequest(data: any) {
  const validations = [
    validateEmail(data.email),
    validateIP(data.ip_address),
    validateNumber(data.attempt_count, 'attempt_count', { required: true, min: 1 })
  ];
  
  return validateInput(validations);
}

export function validateDetectAnomaliesRequest(data: any) {
  const validations = [
    validateUUID(data.user_id, 'user_id'),
    validateString(data.action_type, 'action_type', { required: true, maxLength: 100 }),
  ];
  
  return validateInput(validations);
}

export function validateLogErrorRequest(data: any) {
  const validations = [
    validateString(data.action_type, 'action_type', { required: true, maxLength: 100 }),
    validateString(data.entity_type, 'entity_type', { maxLength: 100 })
  ];
  
  return validateInput(validations);
}

export function validateTriggerAlertRequest(data: any) {
  const validations = [
    validateString(data.event_type, 'event_type', { required: true, maxLength: 100 }),
    validateEnum(data.severity, 'severity', ['low', 'medium', 'high', 'critical']),
    validateString(data.message, 'message', { required: true, maxLength: 500 })
  ];
  
  return validateInput(validations);
}

export function validatePlaidExchangeRequest(data: any) {
  const validations = [
    validateString(data.public_token, 'public_token', { required: true, maxLength: 500 }),
    validateUUID(data.practice_id, 'practice_id')
  ];
  
  return validateInput(validations);
}

export function validatePlaidCreateLinkRequest(data: any) {
  const validations = [
    validateUUID(data.user_id, 'user_id')
  ];
  
  return validateInput(validations);
}

export function validateUpdateShippingRequest(data: any) {
  const validations = [
    validateUUID(data.orderLineId, 'orderLineId'),
    validateString(data.trackingNumber, 'trackingNumber', { maxLength: 100 }),
    validateEnum(data.carrier, 'carrier', ['fedex', 'ups', 'usps'], false),
    validateEnum(data.status, 'status', ['pending', 'filled', 'shipped', 'delivered', 'denied', 'change_requested'], false),
    validateString(data.changeDescription, 'changeDescription', { maxLength: 1000 })
  ];
  
  return validateInput(validations);
}

export function validateManageProviderStatusRequest(data: any) {
  const validations = [
    validateUUID(data.providerId, 'providerId'),
    validateBoolean(data.active, 'active', true)
  ];
  
  return validateInput(validations);
}

export function validateApproveUserRequest(data: any) {
  const validations = [
    validateUUID(data.userId, 'userId'),
    validateBoolean(data.approved, 'approved', true),
    validateString(data.reason, 'reason', { maxLength: 500 })
  ];
  
  return validateInput(validations);
}

export function validateAssignRoleRequest(data: any) {
  const validations = [
    validateUUID(data.userId, 'userId'),
    validateEnum(data.role, 'role', ['admin', 'doctor', 'provider', 'pharmacy', 'practice', 'topline', 'downline'], true),
    validateString(data.name, 'name', { maxLength: 255 }),
    validateEmail(data.email)
  ];
  
  return validateInput(validations);
}

export function validateResetPasswordRequest(data: any) {
  const validations = [
    validateEmail(data.email)
  ];
  
  return validateInput(validations);
}

export function validateSendNotificationRequest(data: any) {
  const validations = [
    validateUUID(data.userId, 'userId'),
    validateString(data.title, 'title', { required: true, maxLength: 200 }),
    validateString(data.message, 'message', { required: true, maxLength: 1000 }),
    validateEnum(data.type, 'type', ['info', 'success', 'warning', 'error'], false),
    validateEnum(data.severity, 'severity', ['info', 'warning', 'error'], false)
  ];
  
  return validateInput(validations);
}

export function validateSendWelcomeEmailRequest(data: any) {
  const validations = [
    validateEmail(data.email),
    validateString(data.name, 'name', { required: true, maxLength: 255 }),
    validateString(data.password, 'password', { required: true, minLength: 8, maxLength: 100 })
  ];
  
  return validateInput(validations);
}

export function validateValidateAddressRequest(data: any) {
  const validations = [
    validateString(data.address, 'address', { required: true, maxLength: 500 }),
    validateString(data.city, 'city', { maxLength: 100 }),
    validateString(data.state, 'state', { maxLength: 2 }),
    validateString(data.zipCode, 'zipCode', { maxLength: 10 })
  ];
  
  return validateInput(validations);
}

export function validateBulkVerifyAddressesRequest(data: any) {
  const validations = [
    validateArray(data.addresses, 'addresses', { required: true, minLength: 1, maxLength: 100 })
  ];
  
  return validateInput(validations);
}

export function validateRouteOrderRequest(data: any) {
  const validations = [
    validateUUID(data.product_id, 'product_id'),
    validateString(data.destination_state, 'destination_state', { required: true, maxLength: 2 })
  ];
  
  return validateInput(validations);
}

export function validateGenerateReceiptRequest(data: any) {
  const validations = [
    validateUUID(data.orderId, 'orderId')
  ];
  
  return validateInput(validations);
}

export function validateGeneratePrescriptionRequest(data: any) {
  const validations = [
    validateUUID(data.orderLineId, 'orderLineId')
  ];
  
  return validateInput(validations);
}

export function validateGenerateTermsRequest(data: any) {
  const validations = [
    validateUUID(data.termsId, 'termsId')
  ];
  
  return validateInput(validations);
}

export function validateManageProductTypeRequest(data: any) {
  const validations = [
    validateEnum(data.action, 'action', ['create', 'update', 'delete'], true),
    validateString(data.name, 'name', { maxLength: 255 }),
    validateString(data.description, 'description', { maxLength: 1000 })
  ];
  
  return validateInput(validations);
}

export function validateLogCredentialAccessRequest(data: any) {
  const validations = [
    validateUUID(data.profile_id, 'profile_id'),
    validateArray(data.accessed_fields, 'accessed_fields', { required: true, minLength: 1 })
  ];
  
  return validateInput(validations);
}
