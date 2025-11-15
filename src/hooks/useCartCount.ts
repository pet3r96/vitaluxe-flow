import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCartCount = (cartOwnerId: string | null) => {
  const queryClient = useQueryClient();
  const lastOwnerIdRef = useRef<string | null>(null);

  // Listen for impersonation changes - only invalidate if owner changed
  useEffect(() => {
    const handleImpersonationChange = () => {
      console.log('[useCartCount] Impersonation changed - invalidating cart queries');
      // Only invalidate if cartOwnerId actually changed
      if (lastOwnerIdRef.current !== cartOwnerId) {
        queryClient.invalidateQueries({ queryKey: ["cart-count", cartOwnerId] });
        queryClient.invalidateQueries({ queryKey: ["cart-owner-id"] });
        queryClient.invalidateQueries({ queryKey: ["cart", cartOwnerId] });
        lastOwnerIdRef.current = cartOwnerId;
      }
    };

    window.addEventListener("impersonation-changed", handleImpersonationChange);
    return () => window.removeEventListener("impersonation-changed", handleImpersonationChange);
  }, [queryClient, cartOwnerId]);

  // Track owner changes
  useEffect(() => {
    lastOwnerIdRef.current = cartOwnerId;
  }, [cartOwnerId]);

  return useQuery({
    queryKey: ["cart-count", cartOwnerId],
    queryFn: async () => {
      if (!cartOwnerId) {
        console.log('[useCartCount] No cart owner ID provided');
        return 0;
      }

      console.log('[useCartCount] Fetching count for owner:', cartOwnerId);

      const { data, error } = await supabase.functions.invoke('get-cart-count', {
        body: { cartOwnerId }
      });

      if (error) {
        console.error('[useCartCount] Error:', error);
        throw error;
      }
      
      console.log('[useCartCount] Final count:', data?.count || 0);
      return data?.count || 0;
    },
    enabled: !!cartOwnerId,
    staleTime: 5000, // 5 second cache to prevent excessive fetches
    gcTime: 10000,
    refetchOnMount: false, // Use cache when available
    refetchOnWindowFocus: false,
  });
};
