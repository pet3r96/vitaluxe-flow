import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to determine if a practice can order RX products
 * RX ordering requires at least one active provider with a valid NPI
 */
export const usePracticeRxPrivileges = () => {
  const { effectivePracticeId, effectiveRole } = useAuth();
  
  // Only practices/providers/staff need this check
  const shouldCheck = ['doctor', 'provider', 'staff'].includes(effectiveRole || '');
  
  const { data, isLoading } = useQuery({
    queryKey: ['practice-rx-privileges', effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return { canOrderRx: false, hasProviders: false };
      
      console.info('[usePracticeRxPrivileges] Checking RX eligibility for practice:', effectivePracticeId);
      
      // Use list-providers function to get accurate provider data (bypasses RLS issues)
      const { data, error } = await supabase.functions.invoke('list-providers', {
        body: { practice_id: effectivePracticeId }
      });
      
      if (error) {
        console.error('[usePracticeRxPrivileges] Error fetching providers:', error);
        return { canOrderRx: false, hasProviders: false };
      }
      
      const providers = data?.providers || [];
      const providersWithNpi = providers.filter((p: any) => p.profiles?.npi) || [];
      
      console.info('[usePracticeRxPrivileges] Provider counts:', {
        total: providers.length,
        withNPI: providersWithNpi.length,
        canOrderRx: providersWithNpi.length > 0
      });
      
      return {
        canOrderRx: providersWithNpi.length > 0,
        hasProviders: providers.length > 0,
        providerCount: providers.length,
        providersWithNpiCount: providersWithNpi.length
      };
    },
    enabled: shouldCheck && !!effectivePracticeId,
    staleTime: 30 * 1000, // Cache for 30 seconds (reduced for faster updates)
    refetchOnWindowFocus: true, // Refetch when user returns to window
  });
  
  return {
    canOrderRx: data?.canOrderRx ?? true, // Default true for non-practice roles
    hasProviders: data?.hasProviders ?? false,
    providerCount: data?.providerCount ?? 0,
    providersWithNpiCount: data?.providersWithNpiCount ?? 0,
    isLoading
  };
};
