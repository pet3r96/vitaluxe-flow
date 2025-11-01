import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PatientPracticeSubscriptionStatus {
  isSubscribed: boolean;
  practiceId: string | null;
  practiceName: string | null;
  status: 'trial' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'payment_failed' | null;
  loading: boolean;
}

/**
 * Hook to check if a patient's associated practice has an active subscription.
 * Used in patient portal to restrict features when practice subscription expires.
 */
export const usePatientPracticeSubscription = (): PatientPracticeSubscriptionStatus => {
  const { effectiveUserId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['patient-practice-subscription', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) {
        return {
          isSubscribed: false,
          practiceId: null,
          practiceName: null,
          status: null
        };
      }

      console.log('[usePatientPracticeSubscription] Checking for user:', effectiveUserId);

      // Get patient account and practice
      const { data: patientAccount, error: patientError } = await supabase
        .from('patient_accounts')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (patientError || !patientAccount?.practice_id) {
        console.warn('[usePatientPracticeSubscription] No practice found for patient');
        return {
          isSubscribed: false,
          practiceId: null,
          practiceName: null,
          status: null
        };
      }

      console.log('[usePatientPracticeSubscription] Found practice:', patientAccount.practice_id);

      // Get practice name
      const { data: practice } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', patientAccount.practice_id)
        .maybeSingle();

      // Check practice subscription status
      const { data: subscription, error: subError } = await supabase
        .from('practice_subscriptions' as any)
        .select('status, trial_ends_at, current_period_end, grace_period_ends_at')
        .eq('practice_id', patientAccount.practice_id)
        .maybeSingle() as { data: any; error: any };

      if (subError || !subscription) {
        console.warn('[usePatientPracticeSubscription] No subscription found for practice');
        return {
          isSubscribed: false,
          practiceId: patientAccount.practice_id,
          practiceName: practice?.name || null,
          status: null
        };
      }

      const now = new Date();
      let isSubscribed = false;

      // Check if subscription is active
      if (subscription.status === 'trial' && subscription.trial_ends_at) {
        isSubscribed = new Date(subscription.trial_ends_at) > now;
      } else if (subscription.status === 'active' && subscription.current_period_end) {
        isSubscribed = new Date(subscription.current_period_end) > now;
      } else if (subscription.status === 'suspended' && subscription.grace_period_ends_at) {
        // Suspended subscriptions are still "subscribed" until grace period ends
        isSubscribed = new Date(subscription.grace_period_ends_at) > now;
      }

      console.log('[usePatientPracticeSubscription] Subscription status:', {
        status: subscription.status,
        isSubscribed
      });

      return {
        isSubscribed,
        practiceId: patientAccount.practice_id,
        practiceName: practice?.name || null,
        status: subscription.status as any
      };
    },
    enabled: !!effectiveUserId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    isSubscribed: data?.isSubscribed ?? false,
    practiceId: data?.practiceId ?? null,
    practiceName: data?.practiceName ?? null,
    status: data?.status ?? null,
    loading: isLoading,
  };
};
