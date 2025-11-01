import { supabase } from "@/integrations/supabase/client";

export interface PatientPracticeSubscriptionStatus {
  practiceId: string;
  practiceName: string;
  isSubscribed: boolean;
  status: 'trial' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'payment_failed' | null;
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
    console.error('[PatientSubscriptionCheck] Error fetching patient practice:', patientError);
    return null;
  }

  // Get practice subscription status
  const { data: subscription, error: subError } = await supabase
    .from('practice_subscriptions' as any)
    .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
    .eq('practice_id', patientAccount.practice_id)
    .maybeSingle();

  if (subError) {
    console.error('[PatientSubscriptionCheck] Error fetching subscription:', subError);
    return null;
  }

  const practiceName = Array.isArray(patientAccount.practices) 
    ? patientAccount.practices[0]?.name 
    : (patientAccount.practices as any)?.name || 'Your Practice';

  // No subscription found = inactive
  if (!subscription || typeof subscription !== 'object') {
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

  const sub = subscription as any;
  const now = new Date();
  let isSubscribed = false;

  // Check if subscription is active
  if (sub.status === 'trial' && sub.trial_ends_at) {
    isSubscribed = new Date(sub.trial_ends_at) > now;
  } else if (sub.status === 'active' && sub.current_period_end) {
    isSubscribed = new Date(sub.current_period_end) > now;
  } else if (sub.status === 'suspended' && sub.grace_period_ends_at) {
    isSubscribed = new Date(sub.grace_period_ends_at) > now;
  }

  return {
    practiceId: patientAccount.practice_id,
    practiceName,
    isSubscribed,
    status: sub.status as any,
    trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at) : null,
    currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
    gracePeriodEndsAt: sub.grace_period_ends_at ? new Date(sub.grace_period_ends_at) : null
  };
};
