export interface PaymentMethod {
  id: string;
  practice_id: string;
  payment_type: 'credit_card' | 'bank_account';
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
  
  // Plaid fields (legacy)
  plaid_access_token_encrypted?: string;
  plaid_account_id?: string;
  
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

export interface CardData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

export interface AcceptJsResponse {
  success: boolean;
  opaqueData?: {
    dataDescriptor: string;
    dataValue: string;
  };
  messages?: {
    resultCode: string;
    message: Array<{ code: string; text: string }>;
  };
}

export interface OrderRefund {
  id: string;
  order_id: string;
  refund_transaction_id: string;
  original_transaction_id: string;
  refund_amount: number;
  refund_reason?: string;
  refund_type: 'full' | 'partial';
  refunded_by?: string;
  refund_status: 'pending' | 'approved' | 'declined' | 'error';
  authorizenet_response?: any;
  created_at: string;
  updated_at: string;
}

export interface BillingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country?: string;
}
