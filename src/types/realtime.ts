/**
 * Realtime Subscription Types
 * 
 * Type-safe interfaces for Supabase Realtime subscriptions.
 * Re-exports and extends Supabase's native realtime types.
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/**
 * Generic Realtime Payload (extends Supabase native type)
 */
export type RealtimePayload<T = Record<string, any>> = RealtimePostgresChangesPayload<T>;

/**
 * Postgres Changes Event Types
 */
export type PostgresChangesEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

/**
 * Postgres Changes Filter
 */
export interface PostgresChangesFilter {
  event: PostgresChangesEvent;
  schema: string;
  table: string;
  filter?: string;
}

/**
 * Realtime Callback Function
 */
export type RealtimeCallback<T = Record<string, any>> = (payload: RealtimePostgresChangesPayload<T>) => void;

/**
 * Realtime Channel Map
 */
export type RealtimeChannelMap = Map<string, RealtimeChannel>;

/**
 * Table Dependencies Configuration
 */
export type TableDependencies = Record<string, string[]>;

/**
 * Realtime Subscription Options
 */
export interface RealtimeSubscriptionOptions<T = Record<string, any>> {
  table: string;
  callback?: RealtimeCallback<T>;
  filter?: string;
  event?: PostgresChangesEvent;
}

/**
 * Realtime Manager Interface
 */
export interface IRealtimeManager {
  subscribe<T = Record<string, any>>(table: string, callback?: RealtimeCallback<T>): RealtimeChannel;
  unsubscribe(table: string): void;
  unsubscribeAll(): void;
  isSubscribed(table: string): boolean;
  getActiveSubscriptions(): string[];
  setUserRole(role: string | null): void;
}

/**
 * Helper to safely access payload.new with type
 */
export function getPayloadNew<T>(payload: RealtimePostgresChangesPayload<T>): T | null {
  return (payload.new && Object.keys(payload.new).length > 0) ? payload.new as T : null;
}

/**
 * Helper to safely access payload.old with type
 */
export function getPayloadOld<T>(payload: RealtimePostgresChangesPayload<T>): T | null {
  return (payload.old && Object.keys(payload.old).length > 0) ? payload.old as T : null;
}

/**
 * Helper type for realtime payloads with id field access
 * Use when you need to access id from payload.new or payload.old
 */
export type RealtimePayloadWithId<T = Record<string, any>> = RealtimePostgresChangesPayload<T> & {
  new: (T & { id?: string }) | Record<string, never>;
  old: (T & { id?: string }) | Record<string, never>;
};
