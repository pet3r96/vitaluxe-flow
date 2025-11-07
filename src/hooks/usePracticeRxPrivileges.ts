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
      
      // Check if practice has at least one active provider with an NPI
      const { data: providers, error } = await supabase
        .from('providers')
        .select('id, user_id, profiles!providers_user_id_fkey(npi)')
        .eq('practice_id', effectivePracticeId)
        .eq('active', true);
      
      if (error) {
        console.error('Error fetching provider NPI status:', error);
        return { canOrderRx: false, hasProviders: false };
      }
      
      const providersWithNpi = providers?.filter(p => p.profiles?.npi) || [];
      
      return {
        canOrderRx: providersWithNpi.length > 0,
        hasProviders: (providers?.length || 0) > 0,
        providerCount: providers?.length || 0,
        providersWithNpiCount: providersWithNpi.length
      };
    },
    enabled: shouldCheck && !!effectivePracticeId,
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });
  
  return {
    canOrderRx: data?.canOrderRx ?? true, // Default true for non-practice roles
    hasProviders: data?.hasProviders ?? false,
    providerCount: data?.providerCount ?? 0,
    providersWithNpiCount: data?.providersWithNpiCount ?? 0,
    isLoading
  };
};
