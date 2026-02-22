/**
 * Payments Domain Types
 * Centralized type definitions for payment processing and Authorize.Net integration
 */

// ============= Payment Methods =============

export interface PaymentMethod {
  id: string;
  practice_id: string;
  payment_type: 'credit_card' | 'bank_account';
  status?: 'active' | 'declined' | 'expired' | 'removed';
  authorizenet_profile_id?: string;
  authorizenet_payment_profile_id?: string;
  
  // Credit card fields
  card_type?: string;
  card_last_five?: string;
  card_expiry?: string;
  
  // Bank account fields
  bank_name?: string;
  account_type?: string;
  account_last_five?: string;
  account_mask?: string;
  routing_number_last_four?: string;
  
  // Billing address
  billing_street?: string;
  billing_city?: string;
  billing_state?: string;
  billing_zip?: string;
  billing_country?: string;
  
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingAddress {
  street: string;
  suite?: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}

// ============= Card Processing =============

export interface CardData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface AcceptJsOpaqueData {
  dataDescriptor: string;
  dataValue: string;
}

export interface AcceptJsMessage {
  code: string;
  text: string;
}

export interface AcceptJsMessages {
  resultCode: string;
  message: AcceptJsMessage[];
}

export interface AcceptJsResponse {
  success: boolean;
  opaqueData?: AcceptJsOpaqueData;
  messages?: AcceptJsMessages;
}

// ============= Refunds =============

export type RefundType = 'full' | 'partial';
export type RefundStatus = 'pending' | 'approved' | 'declined' | 'error';

export interface OrderRefund {
  id: string;
  order_id: string;
  refund_transaction_id: string;
  original_transaction_id: string;
  refund_amount: number;
  refund_reason?: string;
  refund_type: RefundType;
  refunded_by?: string;
  refund_status: RefundStatus;
  authorizenet_response?: unknown;
  created_at: string;
  updated_at: string;
  profiles?: {
    name?: string;
    email?: string;
  };
}

// ============= Edge Function Request/Response Types =============

export interface CreateProfileRequest {
  paymentType: 'credit_card' | 'bank_account';
  cardData?: CardData;
  bankData?: {
    accountNumber: string;
    routingNumber: string;
    accountType: 'checking' | 'savings';
    nameOnAccount: string;
  };
  billingAddress: BillingAddress;
}

export interface RefundRequest {
  orderId: string;
  refundAmount: number;
  refundReason?: string;
  refundType: RefundType;
}

export interface RefundResponse {
  success: boolean;
  refund?: OrderRefund;
  error?: string;
}

// ============= Payment Validation =============

export interface CardValidation {
  isValid: boolean;
  cardType: string;
  errors: string[];
}

export interface ExpiryValidation {
  isExpired: boolean;
  monthsUntilExpiry: number;
}
