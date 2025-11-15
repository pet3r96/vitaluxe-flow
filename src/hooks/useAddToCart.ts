import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AddToCartParams {
  cartOwnerId: string;
  productId: string;
  quantity?: number;
  patientId?: string;
  patientName: string;
  destinationState: string;
  providerId?: string;
}

export const useAddToCart = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddToCartParams) => {
      console.log('[useAddToCart] Adding to cart:', params);

      const { data, error } = await supabase.functions.invoke('add-to-cart', {
        body: params
      });

      if (error) {
        console.error('[useAddToCart] Error:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      console.log('[useAddToCart] Success, invalidating queries');
      // Invalidate cart queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", variables.cartOwnerId] });
      queryClient.invalidateQueries({ queryKey: ["cart-owner"] });
    }
  });
};
