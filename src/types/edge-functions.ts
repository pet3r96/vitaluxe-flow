/**
 * Edge Function Response Types
 * 
 * Type-safe interfaces for Supabase edge function responses.
 * Use these to properly type all supabase.functions.invoke calls.
 */

// ============= Dashboard Stats =============

export interface RepDashboardStats {
  practiceCount: number;
  orderCount: number;
  downlineCount: number;
  profitStats: {
    totalRevenue: number;
    totalProfit: number;
    pendingProfit: number;
    averageOrderValue: number;
  } | null;
}

export interface PharmacyDashboardStats {
  ordersCount: number;
  pendingOrders: number;
  completedOrders: number;
  revenue: number;
}

// ============= User & Role Management =============

export interface AssignRoleResponse {
  success: boolean;
  userId: string;
  role: string;
  message?: string;
}

export interface OrphanedUserSummary {
  total: number;
  fixed: number;
  failed: number;
}

export interface FixOrphanedUsersResponse {
  summary: Record<string, OrphanedUserSummary>;
  details: Array<{
    userId: string;
    email: string;
    role: string;
    status: 'fixed' | 'failed';
    error?: string;
  }>;
}

// ============= Product & Inventory =============

export interface ManageProductTypeResponse {
  success: boolean;
  productTypeId?: string;
  message?: string;
}

export interface ApproveProductResponse {
  success: boolean;
  productId: string;
  message?: string;
}

// ============= Practice Management =============

export interface ApprovePracticeResponse {
  success: boolean;
  practiceId: string;
  userId?: string;
  message?: string;
}

export interface PracticeContextResponse {
  userId: string;
  role: string;
  practiceId: string | null;
  parentPracticeId: string | null;
}

export interface PracticeSubscriptionStatus {
  isSubscribed: boolean;
  subscriptionId: string | null;
  trialDaysRemaining: number | null;
  status: string | null;
}

export interface PracticeUsageStats {
  practiceId: string;
  totalOrders: number;
  totalRevenue: number;
  period: string;
}

// ============= Order & Payment =============

export interface EasyPostTrackingResponse {
  trackingCode: string;
  status: string;
  estimatedDelivery: string | null;
  events: Array<{
    datetime: string;
    status: string;
    message: string;
  }>;
}

export interface GenerateInvoiceResponse {
  pdfUrl: string;
  invoiceNumber: string;
}

// ============= Authentication & Security =============

export interface Reset2FAResponse {
  success: boolean;
  message: string;
}

export interface Send2FASmsResponse {
  success: boolean;
  message: string;
  verificationId?: string;
}

export interface Verify2FASmsResponse {
  success: boolean;
  verified: boolean;
  message: string;
}

export interface SendPasswordResetResponse {
  success: boolean;
  message: string;
}

export interface SetTestPasswordResponse {
  success: boolean;
  message: string;
}

// ============= Data Management =============

export interface SyncUserDataResponse {
  success: boolean;
  synced: number;
  message?: string;
}

export interface CleanupTestDataResponse {
  success: boolean;
  deleted: {
    users: number;
    profiles: number;
    orders: number;
    patients: number;
  };
  message?: string;
}

export interface FactoryResetResponse {
  success: boolean;
  message: string;
  details?: {
    tablesCleared: string[];
    recordsDeleted: number;
  };
}

// ============= Status & Configuration =============

export interface ManageStatusConfigsResponse {
  success: boolean;
  statusConfigId?: string;
  message?: string;
}

export interface ApproveRescheduleResponse {
  success: boolean;
  appointmentId: string;
  message?: string;
}

// ============= Notifications & Communication =============

export interface SendWelcomeEmailResponse {
  success: boolean;
  message: string;
}

export interface SendNotificationResponse {
  success: boolean;
  notificationId?: string;
  message?: string;
}

// ============= Error Logging =============

export interface LogErrorResponse {
  success: boolean;
  errorId?: string;
}

// ============= Generic Response Wrapper =============

export interface EdgeFunctionResponse<T = any> {
  data: T | null;
  error: {
    message: string;
    code?: string;
    details?: any;
  } | null;
}

// ============= Type Guards =============

export function isEdgeFunctionError(response: EdgeFunctionResponse<any>): response is EdgeFunctionResponse<null> & { error: NonNullable<EdgeFunctionResponse['error']> } {
  return response.error !== null;
}

export function hasEdgeFunctionData<T>(response: EdgeFunctionResponse<T>): response is EdgeFunctionResponse<T> & { data: NonNullable<EdgeFunctionResponse<T>['data']> } {
  return response.data !== null;
}
