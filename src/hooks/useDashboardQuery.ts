import { useQuery, UseQueryOptions } from '@tanstack/react-query';

/**
 * Optimized React Query wrapper for dashboard widgets
 * Provides extended staleTime and caching to prevent unnecessary refetches
 */
export function useDashboardQuery<TData = unknown>(
  queryKey: any[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TData, Error>({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000, // 5 minutes - dashboard data doesn't need constant updates
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false, // Don't refetch when user switches tabs
    refetchOnMount: false, // Use cached data on component mount
    retry: 1, // Only retry once to avoid slow repeated failures
    ...options,
  });
}
