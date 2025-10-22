import { useQueryClient } from "@tanstack/react-query";

/**
 * Hook to prefetch data for likely next navigation
 * Improves perceived performance by loading data before user navigates
 * 
 * Note: Prefetching is done by warming up the cache before navigation
 * The actual queries in components will use their specific query keys
 */
export const useQueryPrefetch = () => {
  const queryClient = useQueryClient();

  // Prefetch functions warm up the cache by invalidating queries
  // This triggers a refetch if the data is stale
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
 * Usage: <Link onMouseEnter={() => prefetchOrders()} />
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
