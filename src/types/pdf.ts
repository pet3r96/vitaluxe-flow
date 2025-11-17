/**
 * Type definitions for jsPDF library extensions
 * These types provide type-safe access to jsPDF internal properties
 * 
 * Note: jsPDF and jspdf-autotable extend the library at runtime,
 * but TypeScript types are incomplete. These helpers provide safe access.
 */

import type { jsPDF } from 'jspdf';

/**
 * Interface for jsPDF with autoTable plugin
 * The plugin adds lastAutoTable property at runtime
 */
interface AutoTableExtension {
  lastAutoTable?: {
    finalY: number;
  };
}

/**
 * Interface for jsPDF internal structure
 * Used for accessing page information
 */
interface InternalPages {
  pages?: unknown[];
  getNumberOfPages?: () => number;
}

/**
 * Safely get the last auto table's finalY position
 * @returns The finalY position or 0 if not available
 */
export function getLastAutoTableY(doc: jsPDF): number {
  const docWithTable = doc as jsPDF & AutoTableExtension;
  return docWithTable.lastAutoTable?.finalY ?? 0;
}

/**
 * Get total number of pages in PDF
 */
export function getTotalPages(doc: jsPDF): number {
  const internal = (doc as { internal: InternalPages }).internal;
  
  if (internal.getNumberOfPages) {
    return internal.getNumberOfPages();
  }
  
  if (internal.pages && Array.isArray(internal.pages)) {
    return internal.pages.length - 1;
  }
  
  return 1;
}
