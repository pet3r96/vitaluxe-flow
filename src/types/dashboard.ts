/**
 * Dashboard Widget Types
 * 
 * Type definitions for dashboard components, stats, and activity widgets.
 */

import type { LucideIcon } from "lucide-react";

// ============= Activity Widget Types =============

export interface ActivityItem {
  type: string;
  icon: LucideIcon;
  description: string;
  time: string;
}

export interface RecentActivityWidgetProps {
  className?: string;
  activities?: ActivityItem[] | RawPharmacyActivity[];
  isPharmacy?: boolean;
}

export interface RawPharmacyActivity {
  id: string;
  order_id: string;
  status: string | null;
  created_at: string;
  patient_name: string;
}

export interface PharmacyOrderLineActivity extends RawPharmacyActivity {}

export interface OrderLineActivity {
  order_id: string;
  updated_at: string;
  orders: {
    id: string;
    status: string;
    updated_at: string;
  };
}

export interface MessageThreadActivity {
  id: string;
  subject: string;
  updated_at: string;
  thread_type: string;
}

// ============= Alert Types =============

export interface AdminAlert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
  resolved: boolean;
  pharmacies: {
    name: string;
  } | null;
}

// ============= Discount Code Stats =============

export interface DiscountCode {
  id: string;
  code: string;
  discount_percentage: number;
  active: boolean;
  max_uses: number | null;
  max_uses_per_user: number | null;
  valid_from: string | null;
  valid_until: string | null;
  description: string | null;
}

export interface DiscountCodeStats {
  total_uses: number;
  unique_users: number;
  total_discount_amount: number;
  total_orders: number;
}

export interface DiscountCodeOrder {
  id: string;
  created_at: string;
  total_amount: number;
  discount_amount: number | null;
  discount_percentage: number | null;
  status: string | null;
  profiles: {
    name: string | null;
    email: string;
  } | null;
}

// ============= Price Override Types =============

export interface RepProductPriceOverride {
  id: string;
  rep_id: string;
  product_id: string;
  override_topline_price: number | null;
  override_downline_price: number | null;
  override_retail_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface PendingOverride {
  override_topline_price: string;
  override_downline_price: string;
  override_retail_price: string;
}

// ============= Chart Data Types =============

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface DashboardStats {
  total: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'neutral';
}

// ============= Revenue & Product Analytics =============

export interface RevenueDataPoint {
  name: string;
  revenue: number;
}

export interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
  trend: string;
}

export interface OrderLineWithProduct {
  product_id: string;
  price: number;
  products: {
    name: string;
  } | null;
}
