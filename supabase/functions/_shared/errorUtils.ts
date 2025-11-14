/**
 * Shared error handling utilities for edge functions
 */

/**
 * Safely extracts error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Creates a standardized error response for edge functions
 */
export function createErrorResponse(
  error: unknown,
  defaultMessage = 'An error occurred',
  status = 500,
  corsHeaders: Record<string, string> = {}
): Response {
  const message = getErrorMessage(error);
  return new Response(
    JSON.stringify({ error: message || defaultMessage }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
