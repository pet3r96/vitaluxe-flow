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
        const { data: cartData, error: cartError } = await supabase
          .from("cart")
          .select("id")
          .eq("doctor_id", userId)
          .maybeSingle();

        if (cartError) throw cartError;
        if (!cartData) return { id: '', lines: [] };

      // Build select query
      let selectFields = `
        *,
        product:products(${productFields})
      `;

      if (includePharmacy) {
        selectFields += `,pharmacy:pharmacies(name)`;
      }

      if (includeProvider) {
        selectFields += `,provider:providers(
          id,
          user_id,
          profiles!providers_user_id_fkey(name, npi, dea)
        )`;
      }

      const { data: linesRaw, error: linesError } = await supabase
        .from("cart_lines")
        .select(selectFields)
        .eq("cart_id", cartData.id)
        .gte("expires_at", new Date().toISOString());

      if (linesError) throw linesError;

      const lines = (linesRaw || []) as any[] as CartLine[];

      // Manually hydrate patient data if requested
      if (hydratePatients) {
        const patientIds = Array.from(
          new Set(lines.map((l) => l.patient_id).filter(Boolean))
        );
        
        if (patientIds.length > 0) {
          const { data: patients, error: patientsError } = await supabase
            .from("patient_accounts")
            .select(
              "id, name, first_name, last_name, address_street, address_city, address_state, address_zip, address_formatted"
            )
            .in("id", patientIds);

          if (!patientsError && patients) {
            const patientMap = new Map(patients.map((p: any) => [p.id, p]));
            for (const line of lines) {
              if (line.patient_id) {
                const patient = patientMap.get(line.patient_id) || null;
                line.patient = patient;
                // Preserve patient_name for validation
                line.patient_name = patient?.name || line.patient_name;
              }
            }
          }
        }
      }

        return {
          id: cartData.id,
          lines,
        };
      } catch (error) {
        console.error('[useCart] Error fetching cart:', error);
        return { id: '', lines: [] };
      }
    },
    enabled: !!userId && enabled,
    staleTime,
    gcTime: 0, // Don't cache at all - prevent stale cart after order
    refetchOnWindowFocus,
    refetchOnMount,
  });
}
