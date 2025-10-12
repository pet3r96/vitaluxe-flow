import { supabase } from '@/integrations/supabase/client';

interface ErrorLogData {
  action_type: string;
  entity_type: string;
  details: {
    message?: string;
    source?: string;
    line?: number;
    column?: number;
    stack?: string;
    url?: string;
    browser?: string;
    reason?: any;
    promise?: any;
    timestamp?: string;
    [key: string]: any;
  };
}

const logError = async (data: ErrorLogData) => {
  try {
    await supabase.functions.invoke('log-error', {
      body: data,
    });
  } catch (error) {
    console.error('Failed to log error to backend:', error);
  }
};

export const initializeErrorHandlers = () => {
  // Handle unhandled JavaScript errors
  window.onerror = (message, source, lineno, colno, error) => {
    logError({
      action_type: 'client_error',
      entity_type: 'javascript_error',
      details: {
        message: typeof message === 'string' ? message : String(message),
        source: source || undefined,
        line: lineno || undefined,
        column: colno || undefined,
        stack: error?.stack,
        url: window.location.href,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    });

    // Don't suppress default error handling
    return false;
  };

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError({
      action_type: 'client_error',
      entity_type: 'promise_rejection',
      details: {
        reason: event.reason,
        promise: String(event.promise),
        url: window.location.href,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
      },
    });
  });

  console.log('Error handlers initialized');
};
