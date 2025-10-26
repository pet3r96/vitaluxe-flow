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
  validateDEA,
  validateState
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

export function validateCreateAccountRequest(data: any) {
  const validations = [
    validateEnum(data.role, 'role', ['admin', 'doctor', 'provider', 'pharmacy', 'practice', 'topline', 'downline'], true),
    validateString(data.name, 'name', { required: true, maxLength: 255 }),
    validateEmail(data.email)
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
  const pwd = data.password || data.temporaryPassword;
  const validations = [
    validateEmail(data.email),
    validateString(data.name, 'name', { required: true, maxLength: 255 }),
    validateString(pwd, 'password/temporaryPassword', { required: true, minLength: 8, maxLength: 100 })
  ];
  
  return validateInput(validations);
}

export function validateValidateAddressRequest(data: any) {
  const validations = [
    validateString(data.street, 'street', { required: true, maxLength: 500 }),
    validateString(data.city, 'city', { maxLength: 100 }),
    validateString(data.state, 'state', { maxLength: 2 }),
    validateString(data.zip, 'zip', { maxLength: 10 })
  ];
  
  return validateInput(validations);
}

export function validateBulkVerifyAddressesRequest(data: any) {
  const validations = [
    validateEnum(data.entity_type, 'entity_type', ['providers', 'pharmacies', 'patients', 'all'], false)
  ];
  
  return validateInput(validations);
}

export function validateRouteOrderRequest(data: any) {
  const validations = [
    validateUUID(data.product_id, 'product_id'),
    validateState(data.destination_state, 'destination_state', true)
  ];
  
  return validateInput(validations);
}

export function validateGenerateReceiptRequest(data: any) {
  const validations = [
    validateUUID(data.order_id, 'order_id')
  ];
  
  return validateInput(validations);
}

export function validateGeneratePrescriptionRequest(data: any) {
  const validations = [
    validateUUID(data.provider_id, 'provider_id'),
    validateString(data.product_name, 'product_name', { required: true, maxLength: 200 }),
    validateString(data.dosage, 'dosage', { maxLength: 100 }),
    validateString(data.sig, 'sig', { maxLength: 500 }),
    validateString(data.patient_name, 'patient_name', { required: true, maxLength: 200 }),
    validateString(data.patient_dob, 'patient_dob', { maxLength: 50 }),
    validateString(data.patient_address, 'patient_address', { maxLength: 500 }),
    validateString(data.patient_address_street, 'patient_address_street', { maxLength: 200 }),
    validateString(data.patient_address_city, 'patient_address_city', { maxLength: 100 }),
    validateState(data.patient_address_state, 'patient_address_state', false),
    validateString(data.patient_address_zip, 'patient_address_zip', { maxLength: 10 }),
    validateString(data.provider_name, 'provider_name', { required: true, maxLength: 200 }),
    validateString(data.practice_name, 'practice_name', { maxLength: 200 }),
    validateString(data.notes, 'notes', { maxLength: 1000 }),
    validateNumber(data.quantity, 'quantity', { min: 1, max: 1000 }),
    validateBoolean(data.is_office_dispensing, 'is_office_dispensing'),
    validateBoolean(data.refills_allowed, 'refills_allowed'),
    validateNumber(data.refills_total, 'refills_total', { min: 0, max: 12 })
  ];
  
  // Optional patient_id validation (only if provided)
  if (data.patient_id) {
    validations.push(validateUUID(data.patient_id, 'patient_id'));
  }
  
  return validateInput(validations);
}

export function validateGenerateTermsRequest(data: any) {
  const validations = [
    validateUUID(data.terms_id, 'terms_id'),
    validateString(data.signature_name, 'signature_name', { required: true, maxLength: 200 }),
  ];
  
  // target_user_id is optional (only used during impersonation)
  if (data.target_user_id) {
    validations.push(validateUUID(data.target_user_id, 'target_user_id'));
  }
  
  return validateInput(validations);
}

export function validateManageProductTypeRequest(data: any) {
  const validations = [
    validateEnum(data.operation, 'operation', ['add', 'delete', 'update', 'getUsage'], true),
    validateString(data.typeName, 'typeName', { maxLength: 100 }),
    validateString(data.newName, 'newName', { maxLength: 100 })
  ];
  
  return validateInput(validations);
}

export function validateLogCredentialAccessRequest(data: any) {
  const validations = [
    validateUUID(data.profile_id, 'profile_id'),
    validateString(data.profile_name, 'profile_name', { required: true, maxLength: 200 }),
    validateString(data.viewer_role, 'viewer_role', { required: true, maxLength: 50 }),
    validateString(data.relationship, 'relationship', { required: true, maxLength: 100 }),
    validateString(data.component_context, 'component_context', { maxLength: 200 })
  ];
  
  return validateInput(validations);
}

export function validateApprovePendingRepRequest(data: any) {
  const validations = [
    validateUUID(data.requestId, 'requestId'),
    validateEnum(data.action, 'action', ['approve', 'reject'], true),
    validateString(data.rejectionReason, 'rejectionReason', { maxLength: 1000 }),
    validateString(data.adminNotes, 'adminNotes', { maxLength: 1000 })
  ];
  
  return validateInput(validations);
}

export function validateApprovePendingPracticeRequest(data: any) {
  const validations = [
    validateUUID(data.requestId, 'requestId'),
    validateEnum(data.action, 'action', ['approve', 'reject'], true),
    validateString(data.rejectionReason, 'rejectionReason', { maxLength: 1000 }),
    validateString(data.adminNotes, 'adminNotes', { maxLength: 1000 })
  ];
  
  return validateInput(validations);
}

export function validateFixOrphanedUsersRequest(data: any) {
  const validations = [
    validateEnum(data.roleType, 'roleType', ['pharmacy', 'practice', 'topline', 'downline', 'provider'], false),
    validateUUID(data.entityId, 'entityId')
  ];
  
  return validateInput(validations);
}

export function validateWebhookRequest(data: any) {
  const validations = [
    validateString(data.eventType, 'eventType', { required: true, maxLength: 100 }),
  ];
  
  // Validate payload structure if present
  if (data.payload) {
    if (data.payload.id) {
      validations.push(validateString(data.payload.id, 'payload.id', { maxLength: 100 }));
    }
  }
  
  return validateInput(validations);
}

export function validateApprovePendingProductRequest(data: any) {
  const validations = [
    validateUUID(data.requestId, 'requestId'),
    validateEnum(data.action, 'action', ['approve', 'reject'], true),
    validateString(data.adminNotes, 'adminNotes', { required: false, maxLength: 1000 }),
  ];

  if (data.action === 'reject') {
    validations.push(
      validateString(data.rejectionReason, 'rejectionReason', { required: true, maxLength: 500 })
    );
  }

  if (data.action === 'approve') {
    validations.push(
      validateNumber(data.adminData?.base_price, 'base_price', { required: true, min: 0 }),
      validateNumber(data.adminData?.retail_price, 'retail_price', { required: false, min: 0 }),
      validateArray(data.adminData?.assigned_pharmacies, 'assigned_pharmacies', { required: true, minLength: 1 }),
      validateEnum(data.adminData?.scope_type, 'scope_type', ['global', 'scoped'], false)
    );
  }

  return validateInput(validations);
}

export function validateCalculateShippingRequest(data: any) {
  const validations = [
    validateUUID(data.pharmacy_id, 'pharmacy_id'),
    validateEnum(data.shipping_speed, 'shipping_speed', ['ground', '2day', 'overnight'], true)
  ];
  
  return validateInput(validations);
}

export function validateManageStatusConfigRequest(data: any) {
  const validations = [
    validateEnum(data.operation, 'operation', ['create', 'update', 'delete', 'get'], true),
  ];
  
  // Validate config fields based on operation
  if (data.operation === 'create' || data.operation === 'update') {
    validations.push(
      validateString(data.statusConfig?.status_key, 'statusConfig.status_key', { 
        required: true, 
        maxLength: 50
      }),
      validateString(data.statusConfig?.display_name, 'statusConfig.display_name', { 
        required: true, 
        maxLength: 100 
      }),
      validateString(data.statusConfig?.color_class, 'statusConfig.color_class', { 
        maxLength: 50
      }),
      validateNumber(data.statusConfig?.sort_order, 'statusConfig.sort_order', { 
        min: 0, 
        max: 1000 
      })
    );
    
    // Additional pattern validation
    if (data.statusConfig?.status_key && !/^[a-z0-9_]+$/.test(data.statusConfig.status_key)) {
      return { valid: false, errors: ['status_key must contain only lowercase letters, numbers, and underscores'] };
    }
    if (data.statusConfig?.color_class && !/^[a-z0-9-]+$/.test(data.statusConfig.color_class)) {
      return { valid: false, errors: ['color_class must contain only lowercase letters, numbers, and hyphens'] };
    }
  }
  
  if (data.operation === 'update' || data.operation === 'delete') {
    validations.push(validateUUID(data.statusConfigId, 'statusConfigId'));
  }
  
  return validateInput(validations);
}
