import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCartCount = (cartOwnerId: string | null) => {
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
    staleTime: 1000, // Allow 1 second cache for faster UI
    gcTime: 5000, // Keep count in memory for 5 seconds max
    refetchOnMount: true, // Always check cart on mount
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
