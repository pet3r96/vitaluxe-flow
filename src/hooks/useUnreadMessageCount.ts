import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessageCount(userId: string | null) {
  return useQuery({
    queryKey: ["unread-message-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      // Determine which RPC to use based on user role
      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      const hasPatientRole = userRoles?.some(r => r.role === 'patient');

      // Use patient-specific RPC for patients, regular RPC for others
      const rpcFunction = hasPatientRole ? 'get_patient_unread_message_count' : 'get_unread_message_count';

      const { data, error } = await supabase.rpc(rpcFunction, {
        p_user_id: userId
      });
      
      if (error) {
        console.error('Error fetching unread message count:', error);
        return 0;
      }
      
      return data || 0;
    },
    enabled: !!userId,
    staleTime: 60000, // 1 minute
    refetchInterval: 60000, // Refresh every minute
  });
}
