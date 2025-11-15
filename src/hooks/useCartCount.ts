import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCartCount = (cartOwnerId: string | null) => {
  const queryClient = useQueryClient();

  // Listen for impersonation changes and invalidate immediately
  useEffect(() => {
    const handleImpersonationChange = () => {
      console.log('[useCartCount] Impersonation changed - invalidating cart queries');
      queryClient.invalidateQueries({ queryKey: ["cart-count"] });
      queryClient.invalidateQueries({ queryKey: ["cart-owner"] });
    };

    window.addEventListener("impersonation-changed", handleImpersonationChange);
    return () => window.removeEventListener("impersonation-changed", handleImpersonationChange);
  }, [queryClient]);

  return useQuery({
    queryKey: ["cart-count", cartOwnerId],
    queryFn: async () => {
      if (!cartOwnerId) {
        console.log('[useCartCount] No cart owner ID provided');
        return 0;
      }

      console.log('[useCartCount] Fetching count for owner:', cartOwnerId);

      const { data: cart } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", cartOwnerId)
        .maybeSingle();

      console.log('[useCartCount] Cart found:', { cartId: cart?.id, ownerId: cartOwnerId });

      if (!cart) return 0;

      const { count, error } = await supabase
        .from("cart_lines")
        .select("*", { count: "exact", head: true })
        .eq("cart_id", cart.id)
        .gte("expires_at", new Date().toISOString());

      if (error) throw error;
      
      console.log('[useCartCount] Final count:', count || 0);
      return count || 0;
    },
    enabled: !!cartOwnerId,
    staleTime: 0, // No cache - always fetch fresh to ensure accuracy
    gcTime: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
