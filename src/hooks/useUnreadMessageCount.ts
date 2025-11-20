import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessageCount(userId: string | null) {
  return useQuery({
    queryKey: ["unread-message-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      
      const { data, error } = await supabase.rpc('get_unread_message_count', {
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
