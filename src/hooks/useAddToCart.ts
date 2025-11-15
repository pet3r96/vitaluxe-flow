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
      console.log('[useAddToCart] Success, invalidating cart queries for:', variables.cartOwnerId);
      // Invalidate all cart-related queries with consistent key
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return key === 'cart' || key === 'cart-count' || key === 'cart-owner';
        }
      });
    }
  });
};
