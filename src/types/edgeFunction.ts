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
  if (isEdgeFunctionError(data)) {
    return data.error || 'Unknown error';
  }
  if (error) {
    return error.message;
  }
  return 'Unknown error';
}
