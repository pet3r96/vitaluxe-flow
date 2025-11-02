import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized hook for fetching patients list
 * Uses list-patients edge function to bypass RLS
 * Includes 5-minute caching to reduce server load
 */
export function usePatients(practiceId?: string) {
  return useQuery({
    queryKey: ["patients-list", practiceId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('list-patients', {
        body: practiceId ? { practice_id: practiceId } : {}
      });
      
      if (error) throw error;
      return data?.patients || [];
    },
    enabled: !!practiceId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}
