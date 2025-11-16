import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const usePharmacyShippingRates = (pharmacyId: string | null) => {
  return useQuery({
    queryKey: ['pharmacy-shipping-rates-map', pharmacyId],
    queryFn: async () => {
      if (!pharmacyId) return {};
      
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .select('shipping_speed, rate, enabled')
        .eq('pharmacy_id', pharmacyId)
        .eq('enabled', true);
      
      if (error) throw error;
      
      // Convert to map: { ground: 15.00, 2day: 25.00, overnight: 40.00 }
      const rateMap: Record<string, number> = {};
      data?.forEach(rate => {
        rateMap[rate.shipping_speed] = rate.rate;
      });
      
      return rateMap;
    },
    enabled: !!pharmacyId,
    staleTime: 5 * 60 * 1000,
  });
};
