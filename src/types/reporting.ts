/**
 * Reporting and analytics types
 */

export interface ProviderStats {
  [providerId: string]: {
    name: string;
    total: number;
    cancelled: number;
    completed: number;
  };
}

export interface CommissionWithProfile {
  id: string;
  profiles?: {
    full_name?: string;
    email?: string;
  };
  [key: string]: any;
}
