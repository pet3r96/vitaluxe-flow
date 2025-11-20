import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export const useStaffOrderingPrivileges = () => {
  const { effectiveUserId, isStaffAccount } = useAuth();
  
  const { data: canOrder = true, isLoading } = useQuery({
    queryKey: ['staff-ordering-privileges', effectiveUserId],
    queryFn: async () => {
      if (!isStaffAccount || !effectiveUserId) return true;
      
      const { data, error } = await supabase
        .from('providers')
        .select('can_order, role_type')
        .eq('user_id', effectiveUserId)
        .single();
      
      if (error) {
        logger.error('Error fetching staff ordering privileges', error, {
          userId: effectiveUserId,
          isStaffAccount
        });
        return false; // Fail closed for security
      }
      
      // Only apply staff restrictions if this is actually a staff member
      // Providers (role_type='provider') should NOT be restricted
      if (data?.role_type === 'provider') {
        logger.info('Provider account detected, bypassing staff restrictions', {
          userId: effectiveUserId
        });
        return true; // Providers always have access (not subject to staff can_order)
      }
      
      return data?.can_order ?? false;
    },
    enabled: isStaffAccount && !!effectiveUserId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  return {
    canOrder: isStaffAccount ? canOrder : true,
    isLoading,
    isStaffAccount
  };
};
