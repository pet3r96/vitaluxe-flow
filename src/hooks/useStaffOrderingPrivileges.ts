import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useStaffOrderingPrivileges = () => {
  const { user, isStaffAccount } = useAuth();
  
  const { data: canOrder = true, isLoading } = useQuery({
    queryKey: ['staff-ordering-privileges', user?.id],
    queryFn: async () => {
      if (!isStaffAccount || !user?.id) return true;
      
      const { data, error } = await supabase
        .from('practice_staff')
        .select('can_order')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching staff ordering privileges:', error);
        return false; // Fail closed for security
      }
      
      return data?.can_order ?? false;
    },
    enabled: isStaffAccount && !!user?.id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  return {
    canOrder: isStaffAccount ? canOrder : true,
    isLoading,
    isStaffAccount
  };
};
