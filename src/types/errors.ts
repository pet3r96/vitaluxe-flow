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
 * Known authentication error codes from Supabase and custom auth flows
 */
export type AuthErrorCode = 
  | 'email_not_verified'
  | 'temp_password_required'
  | 'account_disabled'
  | 'invalid_credentials'
  | 'user_not_found'
  | 'weak_password'
  | 'email_exists';

/**
 * Authentication error with typed code field
 */
export interface AuthErrorWithCode extends StandardError {
  code: AuthErrorCode;
  email?: string;
}

/**
 * Password status data from database checks
 */
export interface PasswordStatusData {
  must_change_password: boolean;
  terms_accepted: boolean;
}

/**
 * Profile change payload for realtime subscriptions
 */
export interface ProfileChangePayload {
  id: string;
  active: boolean;
  [key: string]: unknown;
}

/**
 * Type guard to check if error has a specific auth error code
 */
export function hasAuthErrorCode(error: unknown, code: AuthErrorCode): error is AuthErrorWithCode {
  return isErrorLike(error) && error.code === code;
}

/**
 * Type guard for authentication errors with codes
 */
export function isAuthError(error: unknown): error is AuthErrorWithCode {
  return (
    isErrorLike(error) && 
    typeof error.code === 'string' &&
    (error.code === 'email_not_verified' || 
     error.code === 'temp_password_required' || 
     error.code === 'account_disabled' ||
     error.code === 'invalid_credentials' ||
     error.code === 'user_not_found' ||
     error.code === 'weak_password' ||
     error.code === 'email_exists')
  );
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
