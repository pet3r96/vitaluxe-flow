import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCartCount = (userId: string | null) => {
  return useQuery({
    queryKey: ["cart-count", userId],
    queryFn: async () => {
      if (!userId) return 0;

      const { data: cart } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", userId)
        .single();

      if (!cart) return 0;

      const { count, error } = await supabase
        .from("cart_lines")
        .select("*", { count: "exact", head: true })
        .eq("cart_id", cart.id);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
    staleTime: 0,
  });
};
