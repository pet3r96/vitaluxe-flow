import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  /**
   * Additional select fields for products
   */
  productFields?: string;
  /**
   * Whether to include pharmacy data
   */
  includePharmacy?: boolean;
  /**
   * Whether to include provider data
   */
  includeProvider?: boolean;
  /**
   * Whether to hydrate patient data from patient_accounts
   */
  hydratePatients?: boolean;
  /**
   * Query is enabled only when this is true
   */
  enabled?: boolean;
  /**
   * How long to consider the cache fresh (ms)
   */
  staleTime?: number;
  /**
   * Whether to refetch on window focus
   */
  refetchOnWindowFocus?: boolean;
  /**
   * Whether to refetch on mount
   */
  refetchOnMount?: boolean;
}

/**
 * Centralized hook for fetching cart data
 * Eliminates duplicate cart-fetching logic across components
 */
export function useCart(
  userId: string | null,
  options: UseCartOptions = {}
) {
  const {
    productFields = "name, dosage, sig, image_url, base_price, requires_prescription",
    includePharmacy = false,
    includeProvider = false,
    hydratePatients = false,
    enabled = true,
    staleTime = 5000,
    refetchOnWindowFocus = false,
    refetchOnMount = true,
  } = options;

  return useQuery({
    queryKey: ["cart", userId, productFields, includePharmacy, includeProvider, hydratePatients],
    queryFn: async (): Promise<Cart> => {
      if (!userId) return { id: '', lines: [] };

      try {
        // Use edge function for cart operations
        const { data, error } = await supabase.functions.invoke('get-cart', {
          body: {
            cartOwnerId: userId,
            productFields,
            includePharmacy,
            includeProvider,
            hydratePatients
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
    enabled: !!userId && enabled,
    staleTime,
    gcTime: 1000, // Keep in memory for 1 second for immediate re-render after checkout
    refetchOnWindowFocus,
    refetchOnMount,
  });
}
