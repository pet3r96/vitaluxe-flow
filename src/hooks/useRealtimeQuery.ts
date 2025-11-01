import { useEffect } from 'react';
import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { realtimeManager } from '@/lib/realtimeManager';

/**
 * Enhanced React Query hook with automatic realtime subscription
 * 
 * Combines React Query caching with Supabase realtime updates.
 * Automatically subscribes to table changes and invalidates cache.
 * 
 * @param queryKey - React Query key (first element should be table name)
 * @param queryFn - Query function to fetch data
 * @param options - React Query options
 * @param onRealtimeEvent - Optional callback for realtime events
 * @returns React Query result
 */
export function useRealtimeQuery<TData = unknown, TError = unknown>(
  queryKey: string[],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>,
  onRealtimeEvent?: (payload: any) => void
): UseQueryResult<TData, TError> {
  const tableName = queryKey[0];

  // Subscribe to realtime updates
  useEffect(() => {
    realtimeManager.subscribe(tableName, onRealtimeEvent);

    return () => {
      // Don't unsubscribe immediately - other components might use the same table
      // The manager handles subscription pooling
    };
  }, [tableName, onRealtimeEvent]);

  // Use standard React Query with optimized settings
  return useQuery<TData, TError>({
    queryKey,
    queryFn,
    ...options,
  });
}
