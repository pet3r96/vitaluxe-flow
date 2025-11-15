import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PharmacyDashboardStats {
  ordersCount: number;
  pendingOrdersCount: number;
  productsCount: number;
  recentActivity: any[];
  ordersByStatus: Record<string, number>;
}

export function usePharmacyDashboard(effectiveUserId: string | null, effectiveRole: string | null) {
  return useQuery({
    queryKey: ["pharmacy-dashboard-stats", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error('No effective user ID');

      console.log('[usePharmacyDashboard] 🚀 Fetching batched dashboard stats');

      const { data, error } = await supabase.functions.invoke<PharmacyDashboardStats>(
        'get-pharmacy-dashboard-stats',
        { 
          method: 'POST',
          body: { effectiveUserId }
        }
      );

      if (error) {
        console.error('[usePharmacyDashboard] ❌ Error:', error);
        // Return empty stats instead of throwing when pharmacy not found
        if (error.message?.includes('Pharmacy not found')) {
          console.warn('[usePharmacyDashboard] ⚠️ No pharmacy record found, returning empty stats');
          return {
            ordersCount: 0,
            pendingOrdersCount: 0,
            productsCount: 0,
            recentActivity: [],
            ordersByStatus: {}
          };
        }
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from pharmacy dashboard endpoint');
      }

      console.log('[usePharmacyDashboard] ✅ Successfully fetched batched dashboard stats');
      return data;
    },
    enabled: !!effectiveUserId && effectiveRole === 'pharmacy',
    staleTime: 0, // Always refetch on mount to avoid stale zeros
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchInterval: 30000,
    retry: false, // Don't retry when pharmacy not found
  });
}
