/**
 * Type-safe error handling utilities
 */

/**
 * Standard error interface with message and optional name
 */
export interface StandardError {
  message: string;
  name?: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Type guard to check if value is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard to check if value has error-like properties
 */
export function isErrorLike(error: unknown): error is StandardError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as StandardError).message === 'string'
  );
}

/**
 * Safely extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (isErrorLike(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Safely extract error name from unknown error
 */
export function getErrorName(error: unknown): string {
  if (isError(error)) {
    return error.name;
  }
  if (isErrorLike(error) && error.name) {
    return error.name;
  }
  return 'Error';
}

/**
 * Safely extract error code from unknown error
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isErrorLike(error)) {
    return error.code;
  }
  return undefined;
}
