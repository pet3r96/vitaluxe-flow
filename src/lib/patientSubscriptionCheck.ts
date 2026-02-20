import { supabase } from "@/integrations/supabase/client";
import type { PracticeSubscription, SubscriptionStatus } from "@/types/subscriptions";
import { logger } from "@/lib/logger";

export interface PatientPracticeSubscriptionStatus {
  practiceId: string;
  practiceName: string;
  isSubscribed: boolean;
  status: SubscriptionStatus | null;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  gracePeriodEndsAt: Date | null;
}

export const getPatientPracticeSubscription = async (
  patientAccountId: string
): Promise<PatientPracticeSubscriptionStatus | null> => {
  // Get patient's practice
  const { data: patientAccount, error: patientError } = await supabase
    .from('patient_accounts')
    .select('practice_id, practices:profiles!patient_accounts_practice_id_fkey(name)')
    .eq('id', patientAccountId)
    .single();

  if (patientError || !patientAccount?.practice_id) {
    logger.error("Error fetching patient practice", patientError, { patientAccountId });
    return null;
  }

  // Get practice subscription status
  const { data: subscription, error: subError } = await supabase
    .from('practice_subscriptions')
    .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
    .eq('practice_id', patientAccount.practice_id)
    .maybeSingle();

  if (subError) {
    logger.error("Error fetching patient subscription", subError, { practiceId: patientAccount.practice_id });
    return null;
  }

  const practiceName = Array.isArray(patientAccount.practices) 
    ? patientAccount.practices[0]?.name 
    : patientAccount.practices?.name || 'Your Practice';

  // No subscription found = inactive
  if (!subscription) {
    return {
      practiceId: patientAccount.practice_id,
      practiceName,
      isSubscribed: false,
      status: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      gracePeriodEndsAt: null
    };
  }

  const sub = subscription as PracticeSubscription;
  const now = new Date();
  let isSubscribed = false;

  // Check if subscription is active
  if (sub.status === 'trial' && sub.trial_ends_at) {
    isSubscribed = new Date(sub.trial_ends_at) > now;
  } else if (sub.status === 'active') {
    isSubscribed = true;
  } else if (sub.status === 'suspended' && sub.grace_period_ends_at) {
    isSubscribed = new Date(sub.grace_period_ends_at) > now;
  }

  return {
    practiceId: patientAccount.practice_id,
    practiceName,
    isSubscribed,
    status: sub.status,
    trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at) : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
    gracePeriodEndsAt: sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : null
  };
};
