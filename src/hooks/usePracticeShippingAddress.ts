import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePracticeShippingAddress = (practiceId: string | null) => {
  return useQuery({
    queryKey: ['practice-shipping-address', practiceId],
    queryFn: async () => {
      if (!practiceId) return null;
      
      // Query from profiles table (not providers)
      const { data, error } = await supabase
        .from('profiles')
        .select('shipping_address_street, shipping_address_city, shipping_address_state, shipping_address_zip')
        .eq('id', practiceId)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!practiceId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
