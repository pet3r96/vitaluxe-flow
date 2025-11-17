import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from '@supabase/supabase-js';
import { logger } from "@/lib/logger";

export const useCartCount = (cartOwnerId: string | null) => {
  const queryClient = useQueryClient();
  const lastOwnerIdRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced invalidation to prevent rapid refetches
  const debouncedInvalidate = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      logger.info('[useCartCount] Realtime event - invalidating cart-count');
      queryClient.invalidateQueries({ queryKey: ["cart-count", cartOwnerId] });
    }, 300);
  }, [queryClient, cartOwnerId]);

  // Set up realtime subscription for cart_lines changes
  useEffect(() => {
    if (!cartOwnerId) {
      return;
    }

    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // First, get the cart_id for this owner
    const setupRealtimeSubscription = async () => {
      const { data: cart } = await supabase
        .from("cart")
        .select("id")
        .eq("doctor_id", cartOwnerId)
        .maybeSingle();

      if (!cart) {
        logger.info('[useCartCount] No cart found for owner', { cartOwnerId });
        return;
      }

      logger.info('[useCartCount] Setting up realtime subscription for cart', { cartId: cart.id });

      // Subscribe to cart_lines changes for this specific cart
      const channel = supabase
        .channel(`cart-lines-${cart.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cart_lines',
            filter: `cart_id=eq.${cart.id}`
          },
          (payload) => {
            logger.info('[useCartCount] Realtime event received', { eventType: payload.eventType });
            debouncedInvalidate();
          }
        )
        .subscribe((status) => {
          logger.info('[useCartCount] Subscription status', { status });
        });

      channelRef.current = channel;
    };

    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [cartOwnerId, debouncedInvalidate]);

  // Listen for impersonation changes - only invalidate if owner changed
  useEffect(() => {
    const handleImpersonationChange = () => {
      logger.info('[useCartCount] Impersonation changed - invalidating cart queries');
      // Only invalidate if cartOwnerId actually changed
      if (lastOwnerIdRef.current !== cartOwnerId) {
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0];
            return key === 'cart' || key === 'cart-count' || key === 'cart-owner' || key === 'cart-owner-id';
          }
        });
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
        logger.info('[useCartCount] No cart owner ID provided');
        return 0;
      }

      logger.info('[useCartCount] Fetching count for owner', { cartOwnerId });

      const { data, error } = await supabase.functions.invoke('get-cart-count', {
        body: { cartOwnerId }
      });

      if (error) {
        logger.error('[useCartCount] Error', error);
        throw error;
      }

      logger.info('[useCartCount] Final count', { count: data?.count || 0 });
      return data?.count || 0;
    },
    enabled: !!cartOwnerId,
    staleTime: 0, // Always fresh - refetch on invalidation
    gcTime: 10000,
    refetchOnMount: true, // Refetch to ensure accuracy
    refetchOnWindowFocus: true, // Update when user returns to tab
  });
};
