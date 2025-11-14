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
        { method: 'POST' }
      );

      if (error) {
        console.error('[usePharmacyDashboard] ❌ Error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from pharmacy dashboard endpoint');
      }

      console.log('[usePharmacyDashboard] ✅ Successfully fetched batched dashboard stats');
      return data;
    },
    enabled: !!effectiveUserId && effectiveRole === 'pharmacy',
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
