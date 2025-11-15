import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface CartLine {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  price_snapshot: number;
  patient_id: string | null;
  patient_name: string | null;
  patient_email: string | null;
  patient_phone: string | null;
  patient_address: string | null;
  shipping_speed: string | null;
  provider_id: string | null;
  destination_state: string | null;
  assigned_pharmacy_id: string | null;
  prescription_url: string | null;
  custom_sig: string | null;
  custom_dosage: string | null;
  order_notes: string | null;
  prescription_method: string | null;
  expires_at: string;
  created_at: string;
  product?: any;
  pharmacy?: any;
  provider?: any;
  patient?: any;
}

export interface Cart {
  id: string;
  lines: CartLine[];
}

interface UseCartOptions {
  productFields?: string;
  includePharmacy?: boolean;
  includeProvider?: boolean;
  hydratePatients?: boolean;
  enabled?: boolean;
  staleTime?: number;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
}

export function useCart(
  userId: string | null,
  options: UseCartOptions = {}
) {
  // Stable defaults - memoized to prevent queryKey changes
  const stableOptions = useMemo(() => {
    return {
      productFields: options.productFields || "name, dosage, sig, image_url, base_price, requires_prescription",
      includePharmacy: options.includePharmacy ?? false,
      includeProvider: options.includeProvider ?? false,
      hydratePatients: options.hydratePatients ?? false,
      enabled: options.enabled ?? true,
      staleTime: options.staleTime ?? 5000,
      refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
      refetchOnMount: options.refetchOnMount ?? true,
    };
  }, [
    options.productFields,
    options.includePharmacy,
    options.includeProvider,
    options.hydratePatients,
    options.enabled,
    options.staleTime,
    options.refetchOnWindowFocus,
    options.refetchOnMount,
  ]);

  return useQuery({
    // Use cartOwnerId consistently with useCartCount
    queryKey: ["cart", userId],
    queryFn: async (): Promise<Cart> => {
      if (!userId) {
        console.log('[useCart] No userId provided, returning empty cart');
        return { id: '', lines: [] };
      }

      try {
        const { data, error } = await supabase.functions.invoke('get-cart', {
          body: {
            cartOwnerId: userId,
            productFields: stableOptions.productFields,
            includePharmacy: stableOptions.includePharmacy,
            includeProvider: stableOptions.includeProvider,
            hydratePatients: stableOptions.hydratePatients
          }
        });

        if (error) {
          console.error('[useCart] Error from get-cart function:', error);
          throw error;
        }

        return data || { id: '', lines: [] };
      } catch (error) {
        console.error('[useCart] Error fetching cart:', error);
        return { id: '', lines: [] };
      }
    },
    enabled: !!userId && stableOptions.enabled,
    staleTime: 5000, // 5 second cache to prevent excessive fetches
    gcTime: 10000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: stableOptions.refetchOnMount,
    retry: 1, // Only retry once on failure
  });
}
