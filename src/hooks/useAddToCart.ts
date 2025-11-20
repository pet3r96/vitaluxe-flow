import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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
      logger.info('[useAddToCart] Adding to cart', { params });

      const { data, error } = await supabase.functions.invoke('manage-cart', {
        body: { action: 'add', ...params }
      });

      if (error) {
        logger.error('[useAddToCart] Error', error);
        throw error;
      }

      return data;
    },
    onSuccess: (_, variables) => {
      logger.info('[useAddToCart] Success - cart added for', { cartOwnerId: variables.cartOwnerId });
      
      // Optimistic update - immediately update cart count
      queryClient.setQueryData(['cart-count', variables.cartOwnerId], (old: number | undefined) => (old || 0) + 1);
      
      // Realtime subscription in useCartCount will handle the update automatically
      // Only invalidate the main cart query for immediate UI feedback
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    }
  });
};
