import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

/**
 * Centralized Error Handler for Edge Functions
 * Provides sanitized error responses and comprehensive logging
 */

/**
 * Generate a unique error reference ID for support tracking
 */
export function generateErrorId(): string {
  return `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Error category for audit logging
 */
export type ErrorCategory = 
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'database'
  | 'external_api'
  | 'internal'
  | 'rate_limit';

/**
 * Sanitize error messages to prevent information disclosure
 */
export function sanitizeError(error: unknown, category: ErrorCategory = 'internal'): string {
  const errorMessages: Record<ErrorCategory, string> = {
    validation: 'Invalid request data. Please check your input and try again.',
    authentication: 'Authentication required. Please sign in and try again.',
    authorization: 'Access denied. You do not have permission to perform this action.',
    database: 'Database operation failed. Please try again or contact support.',
    external_api: 'External service temporarily unavailable. Please try again later.',
    internal: 'Unable to process request. Please try again or contact support.',
    rate_limit: 'Too many requests. Please wait a moment and try again.',
  };

  return errorMessages[category] || errorMessages.internal;
}

/**
 * Log error to audit_logs table via log_audit_event RPC
 */
export async function logError(
  supabase: any,
  error: unknown,
  functionName: string,
  category: ErrorCategory,
  context?: Record<string, any>
): Promise<string> {
  const errorId = generateErrorId();
  
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    await supabase.rpc('log_audit_event', {
      p_action_type: `error_${category}`,
      p_entity_type: 'edge_function',
      p_entity_id: null,
      p_details: {
        error_id: errorId,
        function_name: functionName,
        category,
        error_message: errorMessage,
        error_stack: errorStack,
        context: context || {},
        timestamp: new Date().toISOString(),
      },
    });
  } catch (logError) {
    // Fallback to console if RPC fails
    console.error('Failed to log error to audit_logs:', logError);
    console.error('Original error:', error);
  }
  
  return errorId;
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  message: string,
  status: number,
  errorId?: string | null,
  validationErrors?: string[],
  corsHeaders?: Record<string, string>
): Response {
  const headers = {
    'Content-Type': 'application/json',
    ...(corsHeaders || {}),
  };

  const body: any = {
    error: message,
    success: false,
  };

  if (errorId) {
    body.error_id = errorId;
    body.support_message = `Please provide this error ID to support: ${errorId}`;
  }

  if (validationErrors && validationErrors.length > 0) {
    body.validation_errors = validationErrors;
  }

  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Handle error with comprehensive logging and sanitization
 */
export async function handleError(
  supabase: any,
  error: unknown,
  functionName: string,
  category: ErrorCategory,
  corsHeaders: Record<string, string>,
  context?: Record<string, any>
): Promise<Response> {
  // Log full error details server-side
  const errorId = await logError(supabase, error, functionName, category, context);
  
  // Return sanitized error to client
  const sanitizedMessage = sanitizeError(error, category);
  
  return createErrorResponse(sanitizedMessage, 500, errorId, undefined, corsHeaders);
}

/**
 * Map external API errors to user-friendly messages
 */
export function mapExternalApiError(error: unknown, service: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Common patterns
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
    return `${service} is taking longer than expected. Please try again.`;
  }
  
  if (errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
    return `Cannot connect to ${service}. Please try again later.`;
  }
  
  if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
    return `${service} rate limit reached. Please try again in a few minutes.`;
  }
  
  if (errorMessage.includes('unauthorized') || errorMessage.includes('401')) {
    return `${service} authentication failed. Please contact support.`;
  }
  
  if (errorMessage.includes('forbidden') || errorMessage.includes('403')) {
    return `Access to ${service} denied. Please contact support.`;
  }
  
  // Generic fallback
  return `${service} is temporarily unavailable. Please try again later.`;
}
