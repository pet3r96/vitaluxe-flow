import { corsHeaders } from "./cors.ts";

/**
 * Standardized response helpers for Edge Functions
 */

export function successResponse<T>(data: T, status = 200): Response {
  return new Response(
    JSON.stringify({ 
      success: true, 
      data, 
      timestamp: new Date().toISOString() 
    }),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}

export function errorResponse(
  error: string, 
  status = 400, 
  code?: string,
  details?: any
): Response {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error, 
      code,
      details
    }),
    { 
      status, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    }
  );
}
