import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePharmacyShippingRates = (pharmacyId: string | null) => {
  return useQuery({
    queryKey: ['pharmacy-shipping-rates-map', pharmacyId],
    queryFn: async () => {
      if (!pharmacyId) {
        console.log('[usePharmacyShippingRates] No pharmacy ID provided');
        return {};
      }
      
      console.log('[usePharmacyShippingRates] Fetching rates for pharmacy:', pharmacyId);
      
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .select('shipping_speed, rate, enabled')
        .eq('pharmacy_id', pharmacyId)
        .eq('enabled', true);
      
      if (error) {
        console.error('[usePharmacyShippingRates] Error fetching rates:', error);
        throw error;
      }
      
      console.log('[usePharmacyShippingRates] Fetched rates:', data);
      
      // Convert to map: { ground: 15.00, 2day: 25.00, overnight: 40.00 }
      const rateMap: Record<string, number> = {};
      data?.forEach((rate) => {
        rateMap[rate.shipping_speed] = rate.rate;
      });
      
      return rateMap;
    },
    enabled: !!pharmacyId,
    staleTime: 5 * 60 * 1000,
  });
};
