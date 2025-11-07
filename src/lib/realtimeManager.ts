import { supabase } from '@/integrations/supabase/client';
import { QueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';

/**
 * Centralized Realtime Manager
 * 
 * Manages all realtime subscriptions in a single multiplexed channel per table.
 * Automatically invalidates React Query cache on database changes.
 * Provides debouncing and smart reconnection for optimal performance.
 */
class RealtimeManager {
  private channels = new Map<string, any>();
  private queryClient: QueryClient | null = null;
  private pendingInvalidations = new Map<string, NodeJS.Timeout>();
  private readonly DEBOUNCE_MS = 10; // Ultra-fast updates for instant sync
  
  // Cross-table dependencies - when table A changes, also invalidate queries for B, C
  private tableDependencies: Record<string, string[]> = {
    'patient_appointments': ['calendar-data', 'waiting-room-dashboard', 'today-appointments', 'being-treated-appointments'],
    'practice_rooms': ['calendar-data'],
    'practice_staff': ['calendar-data'],
    'providers': ['calendar-data'],
    'practice_blocked_time': ['calendar-data'],
    'patient_notes': ['engagement-summary'],
    'treatment_plans': ['engagement-summary'],
    'patient_follow_ups': ['engagement-summary', 'follow-up-reminders'],
  };

  /**
   * Initialize with React Query client for automatic cache invalidation
   */
  setQueryClient(client: QueryClient) {
    this.queryClient = client;
    logger.info('RealtimeManager initialized with QueryClient');
  }

  /**
   * Subscribe to realtime updates for a specific table
   * 
   * @param table - Database table name
   * @param callback - Optional callback for custom handling
   * @returns Channel instance
   */
  subscribe(table: string, callback?: (payload: any) => void) {
    // Return existing channel if already subscribed
    if (this.channels.has(table)) {
      logger.info(`Reusing existing realtime channel for ${table}`);
      return this.channels.get(table);
    }

    logger.info(`Creating new realtime channel for ${table}`);
    
    const channel = supabase
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        (payload) => {
          logger.info(`Realtime event on ${table}:`, { 
            event: payload.eventType,
            id: (payload.new as any)?.id || (payload.old as any)?.id 
          });

          // Debounce invalidations to avoid excessive refetches
          this.debouncedInvalidate(table);

          // Execute custom callback if provided
          if (callback) {
            callback(payload);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Successfully subscribed to ${table} realtime updates`);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(
            `Failed to subscribe to ${table} realtime updates`, 
            err,
            { 
              table, 
              status,
              errorMessage: err?.message,
              errorDetails: err
            }
          );
        } else if (status === 'TIMED_OUT') {
          logger.warn(`Realtime subscription timed out for ${table}`, { table, status });
        }
      });

    this.channels.set(table, channel);
    return channel;
  }

  /**
   * Unsubscribe from a specific table's realtime updates
   */
  unsubscribe(table: string) {
    const channel = this.channels.get(table);
    if (channel) {
      logger.info(`Unsubscribing from ${table} realtime updates`);
      supabase.removeChannel(channel);
      this.channels.delete(table);
      
      // Clear any pending invalidations
      const pendingTimeout = this.pendingInvalidations.get(table);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        this.pendingInvalidations.delete(table);
      }
    }
  }

  /**
   * Unsubscribe from all realtime channels
   */
  unsubscribeAll() {
    logger.info(`Unsubscribing from all ${this.channels.size} realtime channels`);
    
    this.channels.forEach((channel, table) => {
      supabase.removeChannel(channel);
      
      // Clear pending invalidations
      const pendingTimeout = this.pendingInvalidations.get(table);
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
      }
    });
    
    this.channels.clear();
    this.pendingInvalidations.clear();
  }

  /**
   * Debounced cache invalidation with cross-table dependencies
   * Invalidates both the changed table and any dependent queries
   */
  private debouncedInvalidate(table: string) {
    // Clear existing timeout if any
    const existingTimeout = this.pendingInvalidations.get(table);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      if (this.queryClient) {
        logger.info(`Invalidating React Query cache for ${table}`);
        
        // Invalidate the main table
        this.queryClient.invalidateQueries({ 
          queryKey: [table],
          refetchType: 'active' // Only refetch active queries
        });
        
        // Invalidate dependent queries for cross-component updates
        const dependencies = this.tableDependencies[table] || [];
        dependencies.forEach(depKey => {
          logger.info(`Invalidating dependent query: ${depKey}`);
          this.queryClient.invalidateQueries({
            queryKey: [depKey],
            refetchType: 'active'
          });
        });
      }
      this.pendingInvalidations.delete(table);
    }, this.DEBOUNCE_MS);

    this.pendingInvalidations.set(table, timeout);
  }

  /**
   * Check if subscribed to a specific table
   */
  isSubscribed(table: string): boolean {
    return this.channels.has(table);
  }

  /**
   * Get all active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.channels.keys());
  }
}

// Export singleton instance
export const realtimeManager = new RealtimeManager();
