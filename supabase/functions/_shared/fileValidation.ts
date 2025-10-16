/**
 * File Validation Utilities
 * 
 * Provides comprehensive file validation including:
 * - Magic byte verification (file signature detection)
 * - MIME type validation
 * - File size limits
 * - Filename sanitization
 * - Path traversal prevention
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedFilename?: string;
}

// Magic bytes for common file types
const MAGIC_BYTES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/jpeg': [[0xFF, 0xD8, 0xFF]], // JPEG
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0]], // DOC
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    [0x50, 0x4B, 0x03, 0x04], // DOCX (ZIP)
    [0x50, 0x4B, 0x05, 0x06],
    [0x50, 0x4B, 0x07, 0x08]
  ],
};

// Allowed MIME types per bucket
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  'prescriptions': ['application/pdf', 'image/jpeg', 'image/png'],
  'contracts': ['application/pdf'],
  'product-images': ['image/jpeg', 'image/png', 'image/webp'],
  'receipts': ['application/pdf'],
};

// File size limits (in bytes)
const MAX_FILE_SIZES: Record<string, number> = {
  'prescriptions': 10 * 1024 * 1024, // 10MB
  'contracts': 5 * 1024 * 1024, // 5MB
  'product-images': 5 * 1024 * 1024, // 5MB
  'receipts': 2 * 1024 * 1024, // 2MB
};

/**
 * Verify file magic bytes match the declared MIME type
 */
export function verifyMagicBytes(buffer: Uint8Array, declaredMimeType: string): boolean {
  const signatures = MAGIC_BYTES[declaredMimeType];
  if (!signatures) {
    console.warn(`No magic byte signature for MIME type: ${declaredMimeType}`);
    return false;
  }

  // Check if buffer matches any of the valid signatures
  return signatures.some(signature => {
    if (buffer.length < signature.length) return false;
    return signature.every((byte, index) => buffer[index] === byte);
  });
}

/**
 * Sanitize filename to prevent path traversal and injection attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  let sanitized = filename.replace(/^.*[\\\/]/, '');
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Remove special characters except dots, dashes, underscores
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Prevent hidden files
  if (sanitized.startsWith('.')) {
    sanitized = '_' + sanitized;
  }
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop();
    sanitized = sanitized.substring(0, 255 - (ext?.length || 0) - 1) + '.' + ext;
  }
  
  return sanitized || 'file';
}

/**
 * Validate file upload
 */
export async function validateFileUpload(
  fileBuffer: Uint8Array,
  filename: string,
  mimeType: string,
  bucketName: string
): Promise<ValidationResult> {
  const errors: string[] = [];
  
  // 1. Sanitize filename
  const sanitizedFilename = sanitizeFilename(filename);
  
  // 2. Validate MIME type is allowed for this bucket
  const allowedTypes = ALLOWED_MIME_TYPES[bucketName];
  if (allowedTypes && !allowedTypes.includes(mimeType)) {
    errors.push(`File type ${mimeType} not allowed for ${bucketName}. Allowed: ${allowedTypes.join(', ')}`);
  }
  
  // 3. Validate file size
  const maxSize = MAX_FILE_SIZES[bucketName];
  if (maxSize && fileBuffer.length > maxSize) {
    errors.push(`File size ${fileBuffer.length} exceeds maximum ${maxSize} bytes`);
  }
  
  // 4. Verify magic bytes match MIME type
  if (!verifyMagicBytes(fileBuffer, mimeType)) {
    errors.push(`File signature does not match declared type ${mimeType}. Possible file spoofing attempt.`);
  }
  
  // 5. Check for minimum file size (prevent empty files)
  if (fileBuffer.length < 100) {
    errors.push('File is too small to be valid');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitizedFilename
  };
}

/**
 * Detect potential executable content in files
 */
export function detectExecutableContent(buffer: Uint8Array): boolean {
  // Check for common executable signatures
  const executableSignatures = [
    [0x4D, 0x5A], // DOS/Windows executable (MZ)
    [0x7F, 0x45, 0x4C, 0x46], // ELF executable
    [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O binary
    [0x23, 0x21], // Shebang (#!)
  ];
  
  return executableSignatures.some(sig => {
    if (buffer.length < sig.length) return false;
    return sig.every((byte, index) => buffer[index] === byte);
  });
}

/**
 * Check for embedded JavaScript in PDFs
 */
export function detectEmbeddedJavaScript(buffer: Uint8Array): boolean {
  const text = new TextDecoder().decode(buffer);
  const jsPatterns = [
    '/JavaScript',
    '/JS',
    '/OpenAction',
    '/AA',
    '/Launch',
  ];
  
  return jsPatterns.some(pattern => text.includes(pattern));
}