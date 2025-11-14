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
    const errorMsg = typeof message === 'string' ? message : String(message);
    
    // Track navigation timing errors separately
    const isNavigationError = 
      errorMsg.includes('useAuth must be used within') ||
      errorMsg.includes('Loading chunk') ||
      errorMsg.includes('Failed to fetch dynamically imported');
    
    logger.error('Unhandled JavaScript Error', error, {
      message: errorMsg,
      source,
      line: lineno,
      column: colno,
      isNavigationError,
      url: window.location.href,
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
