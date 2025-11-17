/**
 * Reports Domain Types
 * Centralized type definitions for report-related data structures
 */

export interface DownlinePerformanceData {
  rep_id: string;
  rep_name: string;
  rep_email: string;
  practice_count: number;
  non_rx_orders: number;
  rx_orders: number;
  total_orders: number;
  total_revenue: number;
  conversion_rate: number;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  activityStatus?: string;
}

export interface RepProductivityData {
  rep_id: string;
  rep_name: string;
  rep_email: string;
  rep_role: string;
  practice_count: number;
  downline_count: number;
  non_rx_orders: number;
  rx_orders: number;
  total_orders: number;
  total_revenue: number;
  total_commissions?: number;
  avg_order_value: number;
  user_id?: string; // For filtering by user
  role?: string; // For role-based filtering
}

export interface ToplineRepProfile {
  id: string;
  profiles?: {
    name?: string;
    email?: string;
  };
}
