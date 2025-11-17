/**
 * Realtime Payload Type Definitions
 * Proper typing for Supabase realtime events
 */

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimePayload<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: RealtimeEventType;
  new: T;
  old: T;
  errors: string[] | null;
}

export interface RealtimeInsertPayload<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT';
  new: T;
  old: Record<string, never>;
  errors: string[] | null;
}

export interface RealtimeUpdatePayload<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'UPDATE';
  new: T;
  old: Partial<T>;
  errors: string[] | null;
}

export interface RealtimeDeletePayload<T = any> {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'DELETE';
  new: Record<string, never>;
  old: T;
  errors: string[] | null;
}

export type RealtimeCallback<T = any> = (payload: RealtimePayload<T>) => void;
