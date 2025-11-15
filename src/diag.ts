/**
 * Diagnostic Mode Instrumentation
 * Enable with: VITE_DIAG=1 npm run dev
 * 
 * Provides performance tracking, render counting, and detailed logging
 * for troubleshooting loops and slow loads.
 */

export const DIAG = import.meta.env.VITE_DIAG === '1';

/**
 * Log a diagnostic message with optional data
 */
export const mark = (label: string, data?: unknown) => {
  if (DIAG) {
    console.log(`[DIAG] ${label}`, data ?? '');
  }
};

/**
 * Count occurrences of an event
 */
export const count = (label: string) => {
  if (DIAG) {
    console.count(`[DIAG] ${label}`);
  }
};

/**
 * Start a performance timer
 */
export const time = (label: string) => {
  if (DIAG) {
    console.time(`[DIAG] ${label}`);
  }
};

/**
 * End a performance timer
 */
export const timeEnd = (label: string) => {
  if (DIAG) {
    console.timeEnd(`[DIAG] ${label}`);
  }
};

/**
 * Log a warning in diagnostic mode
 */
export const warn = (label: string, data?: unknown) => {
  if (DIAG) {
    console.warn(`[DIAG WARNING] ${label}`, data ?? '');
  }
};

/**
 * Log an error in diagnostic mode
 */
export const error = (label: string, data?: unknown) => {
  if (DIAG) {
    console.error(`[DIAG ERROR] ${label}`, data ?? '');
  }
};
