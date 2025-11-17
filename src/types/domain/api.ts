/**
 * API Domain Types
 * Centralized type definitions for API client patterns and responses
 */

// ============= Edge Function Responses =============

export interface EdgeFunctionSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface EdgeFunctionError {
  success: false;
  error: string;
  details?: string | Record<string, unknown>;
  code?: string;
}

export type EdgeFunctionResponse<T = unknown> = EdgeFunctionSuccess<T> | EdgeFunctionError;

// ============= Pharmacy Dashboard API =============

export interface PharmacyOrderLineActivity {
  id: string;
  order_id: string;
  status: string | null;
  created_at: string;
  patient_name: string;
}

export interface PharmacyDashboardResponse {
  ordersCount: number;
  pendingOrdersCount: number;
  productsCount: number;
  recentActivity: PharmacyOrderLineActivity[];
  ordersByStatus: Record<string, number>;
}

// ============= Patient Dashboard API =============

export interface PatientDashboardResponse {
  appointmentsCount: number;
  upcomingAppointmentsCount: number;
  ordersCount: number;
  recentActivity: PatientActivityItem[];
}

export interface PatientActivityItem {
  id: string;
  type: 'appointment' | 'order' | 'message';
  title: string;
  timestamp: string;
  status?: string;
  description?: string;
}

// ============= API Error Handling =============

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  timestamp?: string;
}

export interface ApiValidationError extends ApiError {
  field: string;
  constraint: string;
}

// ============= Type Guards =============

export function isEdgeFunctionError(
  response: unknown
): response is EdgeFunctionError {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === false &&
    'error' in response
  );
}

export function isEdgeFunctionSuccess<T>(
  response: unknown
): response is EdgeFunctionSuccess<T> {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    response.success === true
  );
}
