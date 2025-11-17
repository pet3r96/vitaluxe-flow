/**
 * Edge Function Logger
 * 
 * Structured logging for Supabase Edge Functions with automatic PHI sanitization.
 * 
 * Usage:
 * ```typescript
 * import { edgeLogger } from '../_shared/logger.ts';
 * 
 * edgeLogger.info('Order created', { orderId: '123' });
 * edgeLogger.error('Payment failed', new Error('Timeout'), { userId: user.id });
 * ```
 */

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

class EdgeLogger {
  /**
   * Sanitize data before logging to remove PHI/PII
   */
  private sanitize(data: LogContext): LogContext {
    const sanitized: LogContext = {};
    const piiKeys = [
      'name', 'email', 'phone', 'address', 'patient_name', 'patient_email', 
      'patient_phone', 'patient_address', 'allergies', 'notes', 'prescription_url',
      'custom_dosage', 'custom_sig', 'npi', 'dea', 'license_number', 'ssn',
      'date_of_birth', 'birth_date', 'password', 'token', 'access_token'
    ];

    for (const [key, value] of Object.entries(data)) {
      // Remove PHI fields
      if (piiKeys.some(piiKey => key.toLowerCase().includes(piiKey))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Serialize context to prevent [object Object] in logs
   */
  private serializeContext(context: LogContext): LogContext {
    const serialized: LogContext = {};
    
    for (const [key, value] of Object.entries(context)) {
      if (value === null || value === undefined) {
        serialized[key] = value;
      } else if (value instanceof Error) {
        serialized[key] = {
          message: value.message,
          name: value.name,
          stack: value.stack
        };
      } else if (typeof value === 'object') {
        try {
          serialized[key] = JSON.parse(JSON.stringify(value));
        } catch {
          serialized[key] = String(value);
        }
      } else {
        serialized[key] = value;
      }
    }
    
    return serialized;
  }

  /**
   * Format log entry as JSON for structured logging
   */
  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const sanitized = context ? this.sanitize(context) : {};
    const serialized = this.serializeContext(sanitized);
    
    return JSON.stringify({
      level,
      message,
      timestamp: new Date().toISOString(),
      ...serialized
    });
  }

  /**
   * Info logs - general operational information
   */
  info(message: string, context?: LogContext) {
    console.log(this.formatLog('info', message, context));
  }

  /**
   * Warning logs - non-critical issues
   */
  warn(message: string, context?: LogContext) {
    console.warn(this.formatLog('warn', message, context));
  }

  /**
   * Error logs - failures requiring attention
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorDetails = error instanceof Error ? {
      error_message: error.message,
      error_stack: error.stack,
      error_name: error.name
    } : { error: String(error) };

    console.error(this.formatLog('error', message, {
      ...errorDetails,
      ...context
    }));
  }
}

// Export singleton instance
export const edgeLogger = new EdgeLogger();
