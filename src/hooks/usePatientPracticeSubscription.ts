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
  const { effectiveUserId, session } = useAuth();

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

      // Call consolidated edge function
      const { data: result, error } = await supabase.functions.invoke('patient-practice-context', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (error) {
        console.error('[usePatientPracticeSubscription] Edge function error:', error);
        throw error;
      }

      if (!result?.success) {
        console.error('[usePatientPracticeSubscription] Invalid response:', result);
        return {
          isSubscribed: false,
          status: "error",
          practiceId: null,
          practiceName: null,
          reason: result?.reason || "unknown_error"
        };
      }

      // Handle cases where practice is missing
      if (!result.practice) {
        return {
          isSubscribed: false,
          status: "no_practice",
          practiceId: null,
          practiceName: null,
          reason: result.reason || "no_practice_assigned"
        };
      }

      return {
        isSubscribed: result.isSubscribed ?? false,
        status: result.status || "unknown",
        practiceId: result.practice.id,
        practiceName: result.practice.name,
        reason: undefined
      };
    },
    enabled: !!effectiveUserId && !!session?.access_token,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 1,
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
