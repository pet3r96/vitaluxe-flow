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
  private readonly DEBOUNCE_MS = 0; // NO debounce - instant updates for medical appointments
  
  // Cross-table dependencies - when table A changes, also invalidate queries for B, C
  private tableDependencies: Record<string, string[]> = {
    // Appointments & Clinical
    'patient_appointments': ['calendar-data', 'waiting-room-dashboard', 'today-appointments', 'being-treated-appointments', 'provider-video-sessions', 'dashboard-stats-batched'],
    'practice_rooms': ['calendar-data'],
    'providers': ['calendar-data', 'practices', 'provider-counts'],
    'practice_blocked_time': ['calendar-data'],
    'patient_notes': ['engagement-summary'],
    'treatment_plans': ['engagement-summary'],
    'patient_follow_ups': ['engagement-summary', 'follow-up-reminders'],
    'video_sessions': ['provider-video-sessions'],
    
    // Products & Inventory
    'products': ['products', 'pharmacy-products'],
    'product_pharmacies': ['products', 'pharmacy-products'],
    'product_types': ['product-types'],
    'topline_product_visibility': ['products', 'rep-product-visibility'],
    
    // Orders & Cart
    'orders': ['orders', 'dashboard-stats-batched', 'rep-dashboard-stats-batched', 'pharmacy-dashboard-stats', 'orders-page'],
    'order_lines': ['orders', 'order-details', 'orders-page'],
    'cart': ['cart-items', 'cart-count'],
    'cart_lines': ['cart-items', 'cart-count'],
    
    // Practices & Accounts
    'profiles': ['practices', 'accounts', 'dashboard-profile', 'rep-practices'],
    'user_roles': ['practices', 'accounts'],
    'pending_practices': ['rep-pending-practices', 'pending-practices'],
    'rep_practice_links': ['rep-practices', 'rep-practice-stats'],
    
    // Reps & Commissions
    'reps': ['all-reps-lookup', 'rep-productivity-view', 'rep-practices', 'current-rep-id'],
    'commissions': ['rep-productivity-view', 'rep-dashboard-stats-batched'],
    'pending_reps': ['pending-reps'],
    
    // Patients
    'patient_accounts': ['patients', 'dashboard-stats-batched', 'orders-page'],
    'patient_intake_forms': ['intake-forms', 'intake-reminders'],
    
    // Pharmacies
    'pharmacies': ['pharmacies', 'pharmacy-shipping-rates'],
    'pharmacy_shipping_rates': ['shipping-rates', 'multiple-pharmacy-rates'],
    
    // Communications
    'messages': ['messages', 'unread-messages', 'dashboard-stats-batched'],
    'follow_up_reminders': ['follow-up-reminders'],
    
    // System & Audit
    'audit_logs': ['audit-logs', 'error-logs'],
    'subscriptions': ['subscription-status', 'dashboard-stats-batched'],
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info(`Successfully subscribed to ${table} realtime updates`);
        } else if (status === 'CHANNEL_ERROR') {
          logger.error(`Failed to subscribe to ${table} realtime updates`);
        } else if (status === 'TIMED_OUT') {
          logger.warn(`Realtime subscription timed out for ${table}`);
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
        logger.info(`🔄 Invalidating React Query cache for ${table}`);
        
        // Invalidate the main table
        this.queryClient.invalidateQueries({ 
          queryKey: [table],
          refetchType: 'all' // Refetch ALL queries for instant updates
        });
        
        // Invalidate dependent queries for cross-component updates
        const dependencies = this.tableDependencies[table] || [];
        dependencies.forEach(depKey => {
          logger.info(`🔄 Invalidating dependent query: ${depKey}`);
          this.queryClient.invalidateQueries({
            queryKey: [depKey],
            refetchType: 'all' // Refetch ALL queries for instant updates
          });
        });
        
        // Log completion
        logger.info(`✅ Cache invalidation complete for ${table}`);
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
