/**
 * Shared TypeScript types for Edge Functions
 */

export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  timestamp?: string;
}

export interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: any;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;
