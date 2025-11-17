/**
 * Authentication Domain Types
 * Centralized type definitions for authentication-related data structures
 */

export interface SignUpRoleData {
  practice_id?: string;
  parent_practice_id?: string;
  practice_name?: string;
  npi?: string;
  phone?: string;
  statesServiced?: string[];
  [key: string]: string | string[] | undefined;
}

export interface PasswordCheckResult {
  mustChangePassword: boolean;
  termsAccepted: boolean;
}

export interface TwoFAStatus {
  requires2FASetup: boolean;
  requires2FAVerify: boolean;
  user2FAPhone: string | null;
}
