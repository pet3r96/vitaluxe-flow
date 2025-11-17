/**
 * Domain Types Barrel Export
 * Central export point for all domain-specific types
 */

export * from './orders';
export * from './patients';
export * from './products';
export * from './auth';
export * from './reports';
export * from './video';
export * from './forms';
export * from './hooks';
export * from './api';
export * from './payments';
export * from './notifications';
export * from './admin';
export * from './cart';
export * from './messages';
export * from './calendar';

// Medical vault types exported separately to avoid conflicts with patients.ts
export type { DocumentRecordData, InsuranceRecordData, MedicalVaultAuditLog } from './medical-vault';
