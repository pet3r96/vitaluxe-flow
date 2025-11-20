import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to prefetch data for likely next navigation
 * Improves perceived performance by loading data before user navigates
 * Uses prefetchQuery instead of invalidateQueries for smarter caching
 */
export const useQueryPrefetch = () => {
  const queryClient = useQueryClient();

  // Prefetch functions now use prefetchQuery for proactive loading
  // ✅ REMOVED: prefetchOrders - causes auth errors by bypassing edge function security

  const prefetchPatients = () => {
    queryClient.prefetchQuery({
      queryKey: ["patients"],
      queryFn: async () => {
        const { data } = await supabase
          .from("patient_accounts")
          .select("id, first_name, last_name, email, status")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(100);
        return data || [];
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  const prefetchPractices = () => {
    queryClient.prefetchQuery({
      queryKey: ["practices"],
      queryFn: async () => {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, email, active")
          .eq("active", true)
          .limit(50);
        return data || [];
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  const prefetchProducts = () => {
    queryClient.prefetchQuery({
      queryKey: ["products"],
      queryFn: async () => {
        const { data } = await supabase
          .from("products")
          .select("id, name, price, active, product_type")
          .eq("active", true)
          .limit(100);
        return data || [];
      },
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  return {
    prefetchPatients,
    prefetchPractices,
    prefetchProducts,
  };
};

/**
 * Hook to prefetch data when hovering over navigation links
 */
export const usePrefetchOnHover = () => {
  const { prefetchPatients, prefetchPractices, prefetchProducts } = useQueryPrefetch();

  return {
    onPatientsHover: prefetchPatients,
    onPracticesHover: prefetchPractices,
    onProductsHover: prefetchProducts,
  };
};
