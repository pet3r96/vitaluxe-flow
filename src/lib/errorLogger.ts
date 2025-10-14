import { logger } from './logger';

/**
 * Legacy error logging - migrated to use structured logger
 * This file maintains backward compatibility while using the new logging system
 */

export const logApplicationError = async (
  errorType: string,
  error: Error | unknown,
  context?: Record<string, any>
) => {
  // Use new structured logger
  logger.error(
    `Application Error: ${errorType}`,
    error,
    logger.sanitize(context || {})
  );
};

export const initializeErrorHandlers = () => {
  // Handle unhandled JavaScript errors
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('Unhandled JavaScript Error', error, {
      message: typeof message === 'string' ? message : String(message),
      source,
      line: lineno,
      column: colno,
    });

    // Don't suppress default error handling
    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', event.reason, {
      promise: String(event.promise),
    });
  });

  logger.info('Error handlers initialized');
};
