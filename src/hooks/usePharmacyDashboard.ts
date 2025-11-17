import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PharmacyDashboardResponse } from '@/types/domain/api';
import { logger } from "@/lib/logger";

export function usePharmacyDashboard(effectiveUserId: string | null, effectiveRole: string | null) {
  return useQuery({
    queryKey: ["pharmacy-dashboard-stats", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error('No effective user ID');

      logger.info('[usePharmacyDashboard] Fetching batched dashboard stats');

      const { data, error } = await supabase.functions.invoke<PharmacyDashboardResponse>(
        'get-pharmacy-dashboard-stats',
        { 
          method: 'POST',
          body: { effectiveUserId }
        }
      );

      if (error) {
        logger.error('[usePharmacyDashboard] Error', error);
        // Return empty stats instead of throwing when pharmacy not found
        if (error.message?.includes('Pharmacy not found')) {
          logger.warn('[usePharmacyDashboard] No pharmacy record found, returning empty stats');
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

      logger.info('[usePharmacyDashboard] Successfully fetched batched dashboard stats');
      return data;
    },
    enabled: !!effectiveUserId && effectiveRole === 'pharmacy',
    staleTime: 5 * 60 * 1000, // 5 minutes - avoid unnecessary refetches
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnMount: false, // Use cached data if available
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    retry: false, // Don't retry when pharmacy not found
  });
}
