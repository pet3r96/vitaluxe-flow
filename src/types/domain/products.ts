/**
 * Product Domain Types
 * Centralized type definitions for product-related data structures
 */

export interface ProductQueryParams {
  effectiveUserId: string;
  effectiveRole: string;
  effectivePracticeId: string | null;
  isImpersonating: boolean;
}

export interface ProductVisibility {
  canView: boolean;
  canOrder: boolean;
  isVisible: boolean;
  reason?: string;
}
