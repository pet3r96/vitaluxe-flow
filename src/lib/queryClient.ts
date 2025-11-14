/**
 * Global React Query Configuration
 * Optimized for instant UX with smart caching and minimal refetching
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 60 seconds - rely on realtime for updates
      staleTime: 60 * 1000,
      // Keep data in cache for 5 minutes after last use
      gcTime: 5 * 60 * 1000,
      // Only refetch on window focus for critical data
      refetchOnWindowFocus: true,
      // Fast failures - only retry once
      retry: 1,
      // Don't refetch on mount if data is fresh
      refetchOnMount: false,
    },
    mutations: {
      // Fast failures for mutations too
      retry: 1,
    },
  },
});

