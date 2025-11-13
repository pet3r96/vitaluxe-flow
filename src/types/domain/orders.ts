/**
 * Order Domain Types
 * Centralized type definitions for order-related data structures
 */

export interface OrderQueryMetadata {
  hasRepRecord: boolean;
  practiceCount: number;
  practiceNames: string[];
  isEmpty: boolean;
  emptyReason: 'no_rep' | 'no_practices' | 'no_orders' | null;
}

export interface OrderStatus {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}
