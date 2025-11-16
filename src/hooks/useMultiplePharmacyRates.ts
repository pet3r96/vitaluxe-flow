import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useMultiplePharmacyRates = (pharmacyIds: string[]) => {
  return useQuery({
    queryKey: ['multiple-pharmacy-shipping-rates', pharmacyIds.sort().join(',')],
    queryFn: async () => {
      if (pharmacyIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('pharmacy_shipping_rates')
        .select('pharmacy_id, shipping_speed, rate, enabled')
        .in('pharmacy_id', pharmacyIds)
        .eq('enabled', true);
      
      if (error) throw error;
      
      // Convert to nested map: { pharmacyId: { ground: 15.00, 2day: 25.00, overnight: 40.00 } }
      const ratesMap: Record<string, Record<string, number>> = {};
      
      data?.forEach(rate => {
        if (!ratesMap[rate.pharmacy_id]) {
          ratesMap[rate.pharmacy_id] = {};
        }
        ratesMap[rate.pharmacy_id][rate.shipping_speed] = rate.rate;
      });
      
      return ratesMap;
    },
    enabled: pharmacyIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
};
