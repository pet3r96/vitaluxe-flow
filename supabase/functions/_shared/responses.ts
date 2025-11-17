import { corsHeaders } from "./cors.ts";

/**
 * Standardized response helpers for Edge Functions
 */

export interface ApiError { 
  code: string; 
  message: string; 
  details?: unknown; 
}

export interface ApiResponse<T> { 
  success: boolean; 
  data?: T; 
  error?: ApiError;
  timestamp?: string;
}

export function ok<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ 
      success: true, 
      data,
      timestamp: new Date().toISOString()
    } as ApiResponse<T>), 
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

export function fail(code: string, message: string, details?: unknown, status = 400): Response {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: { code, message, details },
      timestamp: new Date().toISOString()
    } as ApiResponse<never>), 
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

// Legacy aliases for backward compatibility
export function successResponse<T>(data: T, status = 200): Response {
  return ok(data, status);
}

export function errorResponse(
  error: string, 
  status = 400, 
  code?: string,
  details?: any
): Response {
  return fail(code || "ERROR", error, details, status);
}
