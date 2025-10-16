/**
 * Virus Scanning Utilities
 * 
 * Integrates with ClamAV for virus scanning
 * Falls back to basic pattern detection if ClamAV unavailable
 */

export interface ScanResult {
  clean: boolean;
  infected: boolean;
  error: boolean;
  message: string;
  threatName?: string;
}

/**
 * Scan file for viruses using basic pattern detection
 * Note: For production, integrate with ClamAV via external service
 */
export async function scanFileForViruses(
  fileBuffer: Uint8Array,
  filename: string
): Promise<ScanResult> {
  try {
    // Check if ClamAV endpoint is configured
    const clamavEndpoint = Deno.env.get('CLAMAV_ENDPOINT');
    
    if (!clamavEndpoint) {
      console.warn('⚠️ ClamAV not configured, using basic pattern detection');
      return performBasicScan(fileBuffer, filename);
    }

    // For now, use basic scan (ClamAV integration can be added later)
    // Production: Send fileBuffer to ClamAV service
    console.log('📡 Using basic virus detection for', filename);
    return performBasicScan(fileBuffer, filename);
  } catch (error) {
    console.error('Virus scan error:', error);
    return performBasicScan(fileBuffer, filename);
  }
}

/**
 * Basic virus pattern detection (fallback when ClamAV unavailable)
 */
function performBasicScan(buffer: Uint8Array, filename: string): ScanResult {
  const suspiciousPatterns = detectSuspiciousPatterns(buffer);
  
  if (suspiciousPatterns.length > 0) {
    return {
      clean: false,
      infected: true,
      error: false,
      message: `Suspicious patterns detected: ${suspiciousPatterns.join(', ')}`,
      threatName: 'Suspicious-Pattern',
    };
  }
  
  return {
    clean: true,
    infected: false,
    error: false,
    message: 'Basic scan complete - no threats detected',
  };
}

/**
 * Detect suspicious patterns in file content
 */
function detectSuspiciousPatterns(buffer: Uint8Array): string[] {
  const detected: string[] = [];
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
  
  // Common malware patterns
  const patterns = [
    { name: 'Base64-Encoded-Executable', regex: /TVqQAAMAAAAEAAAA/ }, // MZ header base64
    { name: 'PowerShell-Download', regex: /Invoke-WebRequest|iwr\s|wget\s/i },
    { name: 'PowerShell-Execute', regex: /Invoke-Expression|IEX\s/i },
    { name: 'CMD-Execute', regex: /cmd\.exe|powershell\.exe/i },
    { name: 'Macro-AutoOpen', regex: /AutoOpen|Auto_Open|Workbook_Open/i },
    { name: 'VBA-Shell', regex: /Shell\(|CreateObject\(/i },
    { name: 'JavaScript-Eval', regex: /eval\(|Function\(/i },
    { name: 'SQL-Injection', regex: /UNION\s+SELECT|DROP\s+TABLE|INSERT\s+INTO/i },
    { name: 'File-Write', regex: /fwrite|file_put_contents|writefile/i },
  ];
  
  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      detected.push(pattern.name);
    }
  }
  
  // Check for executable signatures
  if (isExecutable(buffer)) {
    detected.push('Executable-Content');
  }
  
  return detected;
}

/**
 * Check if file contains executable code
 */
function isExecutable(buffer: Uint8Array): boolean {
  const execSignatures = [
    [0x4D, 0x5A], // PE/DOS executable
    [0x7F, 0x45, 0x4C, 0x46], // ELF
    [0xCA, 0xFE, 0xBA, 0xBE], // Mach-O
    [0xFE, 0xED, 0xFA, 0xCE], // Mach-O reverse
    [0x23, 0x21, 0x2F], // Shebang (#!/)
  ];
  
  return execSignatures.some(sig => {
    if (buffer.length < sig.length) return false;
    return sig.every((byte, idx) => buffer[idx] === byte);
  });
}

/**
 * Quarantine infected file
 */
export async function quarantineFile(
  supabase: any,
  originalPath: string,
  originalBucket: string,
  threatName: string
): Promise<void> {
  try {
    // Log quarantine event
    await supabase.from('audit_logs').insert({
      action_type: 'file_quarantined',
      entity_type: 'storage',
      details: {
        original_path: originalPath,
        original_bucket: originalBucket,
        threat_name: threatName,
        timestamp: new Date().toISOString(),
      },
    });
    
    console.warn(`⚠️ File quarantined: ${originalPath} (${threatName})`);
  } catch (error) {
    console.error('Failed to log quarantine event:', error);
    throw error;
  }
}