import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PatientPracticeSubscriptionStatus {
  isSubscribed: boolean;
  status: string;
  loading: boolean;
  practiceId: string | null;
  practiceName: string | null;
  reason?: string;
}

export function usePatientPracticeSubscription(): PatientPracticeSubscriptionStatus {
  const { effectiveUserId, session, effectiveRole } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["patient-practice-subscription", effectiveUserId],
    queryFn: async () => {
      if (!session?.access_token) {
        console.error('[usePatientPracticeSubscription] No session token');
        return {
          isSubscribed: false,
          status: "no_session",
          practiceId: null,
          practiceName: null,
          reason: "no_session"
        };
      }

      // Call unified practice context function
      const { data: result, error } = await supabase.functions.invoke('practice-context', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      // Handle 404 patient_account_not_found gracefully (not a real error, just means no account exists)
      if (error) {
        console.warn('[usePatientPracticeSubscription] Edge function error:', error);
        
        // Check if this is the expected "no patient account" case
        if (error.message?.includes('patient_account_not_found') || 
            result?.status === 'patient_account_not_found' ||
            result?.reason === 'patient_account_not_found') {
          return {
            isSubscribed: false,
            status: "patient_account_not_found",
            practiceId: null,
            practiceName: null,
            reason: "patient_account_not_found"
          };
        }
        
        // For other errors, return error state without throwing
        return {
          isSubscribed: false,
          status: "error",
          practiceId: null,
          practiceName: null,
          reason: error.message || "unknown_error"
        };
      }

      if (!result?.success) {
        console.warn('[usePatientPracticeSubscription] Non-success response:', result);
        
        // Handle patient_account_not_found specifically
        if (result?.status === 'patient_account_not_found' || 
            result?.reason === 'patient_account_not_found') {
          return {
            isSubscribed: false,
            status: "patient_account_not_found",
            practiceId: null,
            practiceName: null,
            reason: "patient_account_not_found"
          };
        }
        
        return {
          isSubscribed: false,
          status: result?.status || "error",
          practiceId: null,
          practiceName: null,
          reason: result?.reason || "unknown_error"
        };
      }

      // Handle cases where practice is missing
      if (!result.practice) {
        return {
          isSubscribed: false,
          status: result.subscription?.status || "no_practice",
          practiceId: null,
          practiceName: null,
          reason: result.reason || "no_practice_assigned"
        };
      }

      // Use the subscription data from unified function - NO fallback logic
      const isSubscribed = result.subscription?.isSubscribed ?? false;
      const status = result.subscription?.status || "unknown";

      console.debug('[usePatientPracticeSubscription] Final result:', {
        status,
        isSubscribed,
        practiceId: result.practice.id,
        practiceName: result.practice.name
      });

      return {
        isSubscribed,
        status,
        practiceId: result.practice.id,
        practiceName: result.practice.name,
        reason: undefined
      };
    },
    // CRITICAL: Only enable for patient role users
    enabled: !!effectiveUserId && !!session?.access_token && effectiveRole === 'patient',
    staleTime: 0, // Always fetch fresh data for subscription checks
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false, // Don't retry on patient_account_not_found errors
  });

  return {
    isSubscribed: data?.isSubscribed ?? false,
    status: data?.status ?? "unknown",
    loading: isLoading,
    practiceId: data?.practiceId ?? null,
    practiceName: data?.practiceName ?? null,
    reason: data?.reason
  };
}
