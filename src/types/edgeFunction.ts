/**
 * Standard response types for edge function calls
 */

export interface EdgeFunctionResponse<T = unknown> {
  data?: T;
  error?: string;
  details?: string | Record<string, unknown>;
}

export interface EdgeFunctionError {
  message: string;
  details?: string | Record<string, unknown>;
}

/**
 * Type guard to check if an edge function response contains an error
 */
export function isEdgeFunctionError(
  response: unknown
): response is EdgeFunctionResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as EdgeFunctionResponse).error === 'string'
  );
}

/**
 * Extract error message from an edge function response
 */
export function getEdgeFunctionError(
  data: unknown,
  error: Error | null
): string {
  // First check if the data payload itself has an error
  if (isEdgeFunctionError(data)) {
    return data.error || 'Unknown error';
  }
  // For FunctionsHttpError (non-2xx), the actual error body is in error.context
  if (error) {
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        // context.json() is async but we can't await here; 
        // callers should use getEdgeFunctionErrorAsync instead
      }
    } catch {
      // ignore
    }
    return error.message;
  }
  return 'Unknown error';
}

/**
 * Async version that extracts the actual error from FunctionsHttpError responses
 */
export async function getEdgeFunctionErrorAsync(
  data: unknown,
  error: Error | null
): Promise<string> {
  if (isEdgeFunctionError(data)) {
    return data.error || 'Unknown error';
  }
  if (error) {
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body?.error) return body.error;
      }
    } catch {
      // Fall through to error.message
    }
    return error.message;
  }
  return 'Unknown error';
}
