// Practice subscription status types
export type SubscriptionStatus = 'trial' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'payment_failed';

export interface PracticeSubscription {
  id: string;
  practice_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_period_ends_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionUpgradePrompt {
  id: string;
  practice_id: string;
  last_shown_at: string | null;
  permanently_dismissed: boolean;
  created_at: string;
  updated_at: string;
}

// Patient portal terms and acceptances
export interface PatientPortalTerms {
  id: string;
  title: string;
  content: string;
  version: number;
  effective_date: string;
  created_at: string;
  updated_at: string;
}

export interface UserTermsAcceptance {
  id: string;
  user_id: string;
  terms_id: string;
  role: string;
  accepted_at: string;
  ip_address: string | null;
  user_agent: string | null;
}

// CSRF and user session types
export interface UserSession {
  id: string;
  user_id: string;
  csrf_token: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

// Provider documents
export interface ProviderDocument {
  id: string;
  practice_id: string;
  document_name: string;
  document_type: string;
  status: 'pending' | 'reviewed' | 'archived';
  is_internal: boolean;
  storage_path: string;
  uploaded_by: string;
  uploaded_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  file_size?: number | null;
  notes?: string | null;
  source_type?: string;
}
