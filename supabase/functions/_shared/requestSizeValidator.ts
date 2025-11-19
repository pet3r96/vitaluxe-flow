/**
 * PHASE 3 - PART 2: REQUEST SIZE VALIDATION
 * 
 * Prevents excessively large requests that could cause DoS or memory issues
 */

import { edgeLogger } from './logger.ts';

// Default max request size: 25 KB
export const DEFAULT_MAX_REQUEST_SIZE = 25 * 1024;

// Exceptions for functions that need larger payloads
export const REQUEST_SIZE_LIMITS: Record<string, number> = {
  'manage-documents': 10 * 1024 * 1024,      // 10 MB for file uploads
  'generate-prescription-pdf': 5 * 1024 * 1024, // 5 MB for PDF generation
  'bulk-invite-patients': 100 * 1024,        // 100 KB for CSV data
  'send-pharmacy-order': 100 * 1024,         // 100 KB for order data
  'upload-medical-vault-document': 10 * 1024 * 1024, // 10 MB for medical docs
  'process-batch-upload': 5 * 1024 * 1024,   // 5 MB for batch processing
};

/**
 * Validate request size against configured limit
 * Returns null if valid, error Response if too large
 */
export function validateRequestSize(
  req: Request,
  functionName?: string,
  corsHeaders?: Record<string, string>
): Response | null {
  const contentLengthHeader = req.headers.get('content-length');
  
  if (!contentLengthHeader) {
    // If no content-length header, we can't validate size
    // This is acceptable for GET requests or empty bodies
    return null;
  }

  const contentLength = parseInt(contentLengthHeader, 10);
  
  if (isNaN(contentLength)) {
    edgeLogger.warn('Invalid content-length header', { value: contentLengthHeader });
    return null;
  }

  // Determine size limit for this function
  const maxSize = functionName && REQUEST_SIZE_LIMITS[functionName]
    ? REQUEST_SIZE_LIMITS[functionName]
    : DEFAULT_MAX_REQUEST_SIZE;

  if (contentLength > maxSize) {
    const sizeMB = (contentLength / (1024 * 1024)).toFixed(2);
    const limitMB = (maxSize / (1024 * 1024)).toFixed(2);
    
    edgeLogger.warn('Request size limit exceeded', {
      function: functionName,
      size: contentLength,
      sizeMB,
      limit: maxSize,
      limitMB
    });

    return new Response(
      JSON.stringify({
        error: 'Request body too large',
        size: contentLength,
        limit: maxSize,
        message: `Request size (${sizeMB} MB) exceeds limit of ${limitMB} MB`
      }),
      {
        status: 413, // Payload Too Large
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }

  // Size is acceptable
  return null;
}

/**
 * Get the size limit for a specific function
 */
export function getSizeLimit(functionName: string): number {
  return REQUEST_SIZE_LIMITS[functionName] || DEFAULT_MAX_REQUEST_SIZE;
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
