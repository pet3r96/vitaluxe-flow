/**
 * Subscription Domain Types
 */

/**
 * Subscription status enum
 */
export type SubscriptionStatus = 
  | 'trial' 
  | 'active' 
  | 'past_due' 
  | 'suspended' 
  | 'expired' 
  | 'cancelled';

/**
 * VitaLuxePro subscription tier
 */
export type SubscriptionTier = 'free' | 'pro' | 'enterprise';

/**
 * Subscription record structure
 */
export interface Subscription {
  id: string;
  practice_id: string;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  status: SubscriptionStatus;
  tier: SubscriptionTier;
  trial_ends_at?: string | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Subscription with profile relation
 */
export interface SubscriptionWithProfile extends Subscription {
  profiles?: {
    id: string;
    name?: string;
    email?: string;
  } | null;
}
