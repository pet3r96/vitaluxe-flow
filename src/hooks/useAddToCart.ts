import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { Cart } from "@/types/domain/cart";

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
    // ✅ TRUE OPTIMISTIC UPDATE - happens BEFORE server responds
    onMutate: async (variables) => {
      // Cancel outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({ queryKey: ['cart'] });
      await queryClient.cancelQueries({ queryKey: ['cart-count', variables.cartOwnerId] });

      // Snapshot previous values for rollback
      const previousCart = queryClient.getQueryData<Cart>(['cart', variables.cartOwnerId]);
      const previousCount = queryClient.getQueryData<number>(['cart-count', variables.cartOwnerId]);

      // Optimistically update cart count immediately
      queryClient.setQueryData(['cart-count', variables.cartOwnerId], (old: number | undefined) => (old || 0) + 1);

      // Optimistically add item to cart for instant UI feedback
      queryClient.setQueryData<Cart>(['cart', variables.cartOwnerId], (old) => {
        if (!old) return old;
        return {
          ...old,
          lines: [...(old.lines || []), {
            // Temporary optimistic item (will be replaced by server response)
            id: 'temp-' + Date.now(),
            product_id: variables.productId,
            patient_name: variables.patientName,
            quantity: variables.quantity || 1,
            destination_state: variables.destinationState,
          } as any],
        };
      });

      logger.info('[useAddToCart] Optimistic update applied');

      // Return context for rollback
      return { previousCart, previousCount };
    },
    // Rollback on error
    onError: (error, variables, context) => {
      logger.error('[useAddToCart] Rolling back optimistic update', error);
      
      if (context?.previousCart) {
        queryClient.setQueryData(['cart', variables.cartOwnerId], context.previousCart);
      }
      if (context?.previousCount !== undefined) {
        queryClient.setQueryData(['cart-count', variables.cartOwnerId], context.previousCount);
      }
    },
    // Refetch after success to get accurate server data
    onSuccess: (_, variables) => {
      logger.info('[useAddToCart] Success - refetching for accurate data');
      queryClient.invalidateQueries({ queryKey: ['cart', variables.cartOwnerId] });
      queryClient.invalidateQueries({ queryKey: ['cart-count', variables.cartOwnerId] });
    }
  });
};
