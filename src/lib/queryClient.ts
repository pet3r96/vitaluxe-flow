/**
 * Global React Query Configuration
 * Optimized for instant UX with smart caching and minimal refetching
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 30 seconds - optimized for medical tech speed
      staleTime: 30 * 1000,
      // Keep data in cache for 2 minutes after last use
      gcTime: 2 * 60 * 1000,
      // Disable refetch on window focus for better performance
      refetchOnWindowFocus: false,
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

