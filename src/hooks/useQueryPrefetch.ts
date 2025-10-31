import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to prefetch data for likely next navigation
 * Improves perceived performance by loading data before user navigates
 */
export const useQueryPrefetch = () => {
  const queryClient = useQueryClient();

  // Prefetch functions invalidate queries to warm cache
  const prefetchOrders = () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };

  const prefetchPatients = () => {
    queryClient.invalidateQueries({ queryKey: ["patients"] });
  };

  const prefetchPractices = () => {
    queryClient.invalidateQueries({ queryKey: ["practices"] });
  };

  const prefetchProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  return {
    prefetchOrders,
    prefetchPatients,
    prefetchPractices,
    prefetchProducts,
  };
};

/**
 * Hook to prefetch data when hovering over navigation links
 */
export const usePrefetchOnHover = () => {
  const { prefetchOrders, prefetchPatients, prefetchPractices, prefetchProducts } = useQueryPrefetch();

  return {
    onOrdersHover: prefetchOrders,
    onPatientsHover: prefetchPatients,
    onPracticesHover: prefetchPractices,
    onProductsHover: prefetchProducts,
  };
};
