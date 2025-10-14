/**
 * Structured Logging System
 * 
 * Provides centralized logging with PHI sanitization and environment-aware behavior:
 * - Development: Logs to console for debugging
 * - Production: Sends errors to backend, suppresses debug logs
 * 
 * CRITICAL: Never log PHI/PII directly. Always use sanitize() first.
 */

import { supabase } from "@/integrations/supabase/client";

type LogLevel = 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = import.meta.env.DEV;

  /**
   * Sanitize data before logging to remove PHI/PII
   * 
   * @example
   * logger.info('Patient saved', logger.sanitize({ 
   *   patient_id: id, 
   *   patient_name: name  // Will be removed
   * }));
   */
  sanitize(data: LogContext): LogContext {
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
   * Development-only logging for debugging
   * Completely suppressed in production
   */
  info(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.log(`[INFO] ${message}`, context || '');
    }
  }

  /**
   * Warning logs - shown in dev, sent to backend in production
   */
  warn(message: string, context?: LogContext) {
    if (this.isDevelopment) {
      console.warn(`[WARN] ${message}`, context || '');
    }
    
    // Send to backend for monitoring
    this.sendToBackend('warn', message, context);
  }

  /**
   * Error logs - shown in dev, sent to backend in both environments
   * Includes stack trace for debugging
   */
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorDetails = error instanceof Error ? {
      message: error.message,
      stack: error.stack,
      name: error.name
    } : { error: String(error) };

    if (this.isDevelopment) {
      console.error(`[ERROR] ${message}`, errorDetails, context || '');
    }

    // Always send errors to backend
    this.sendToBackend('error', message, {
      ...errorDetails,
      ...context
    });
  }

  /**
   * Send log to backend error tracking system
   */
  private async sendToBackend(level: LogLevel, message: string, context?: LogContext) {
    try {
      await supabase.functions.invoke('log-error', {
        body: {
          action_type: 'client_error',
          entity_type: `${level}_log`,
          details: {
            message,
            level,
            url: window.location.href,
            browser: navigator.userAgent,
            timestamp: new Date().toISOString(),
            ...this.sanitize(context || {})
          }
        }
      });
    } catch (err) {
      // Silently fail - don't let logging errors break the app
      if (this.isDevelopment) {
        console.error('[Logger] Failed to send to backend:', err);
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger();
