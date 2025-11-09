import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useStaffOrderingPrivileges = () => {
  const { effectiveUserId, isStaffAccount } = useAuth();
  
  const { data: canOrder = true, isLoading } = useQuery({
    queryKey: ['staff-ordering-privileges', effectiveUserId],
    queryFn: async () => {
      if (!isStaffAccount || !effectiveUserId) return true;
      
      const { data, error } = await supabase
        .from('providers')
        .select('can_order')
        .eq('user_id', effectiveUserId)
        .neq('role_type', 'provider')
        .single();
      
      if (error) {
        console.error('Error fetching staff ordering privileges:', error);
        return false; // Fail closed for security
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
