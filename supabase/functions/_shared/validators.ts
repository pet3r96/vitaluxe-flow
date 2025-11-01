/**
 * Server-side validation utilities for edge functions
 * Must be kept in sync with client-side validators
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePhone(phone: string | null | undefined): ValidationResult {
  if (!phone || phone.trim() === "") return { valid: true };
  
  const cleaned = phone.trim();
  
  if (cleaned.length !== 10) {
    return { valid: false, error: "Phone number must be exactly 10 digits" };
  }
  
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: "Phone number must contain only numbers" };
  }
  
  return { valid: true };
}

export function validateNPI(npi: string | null | undefined): ValidationResult {
  if (!npi || npi.trim() === "") return { valid: true };
  
  const cleaned = npi.trim();
  
  if (cleaned.length !== 10) {
    return { valid: false, error: "NPI must be exactly 10 digits" };
  }
  
  if (!/^\d{10}$/.test(cleaned)) {
    return { valid: false, error: "NPI must contain only numbers" };
  }
  
  return { valid: true };
}

export function validateDEA(dea: string | null | undefined): ValidationResult {
  if (!dea || dea.trim() === "") return { valid: true };
  
  const cleaned = dea.trim().toUpperCase();
  
  if (cleaned.length !== 9) {
    return { valid: false, error: "DEA number must be exactly 9 characters" };
  }
  
  if (!/^[A-Z]{2}\d{7}$/.test(cleaned)) {
    return { 
      valid: false, 
      error: "DEA number must be 2 uppercase letters followed by 7 digits" 
    };
  }
  
  return { valid: true };
}

// UUID validation
export function validateUUID(value: any, fieldName: string): ValidationResult {
  if (!value) return { valid: false, error: `${fieldName} is required` };
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(String(value))) {
    return { valid: false, error: `${fieldName} must be a valid UUID` };
  }
  
  return { valid: true };
}

// Email validation
export function validateEmail(email: any): ValidationResult {
  if (!email) return { valid: false, error: "Email is required" };
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(String(email))) {
    return { valid: false, error: "Invalid email format" };
  }
  
  if (String(email).length > 255) {
    return { valid: false, error: "Email must be less than 255 characters" };
  }
  
  return { valid: true };
}

// String length validation
export function validateString(
  value: any, 
  fieldName: string, 
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationResult {
  const { required = false, minLength = 0, maxLength = 10000 } = options;
  
  if (!value || String(value).trim() === "") {
    if (required) return { valid: false, error: `${fieldName} is required` };
    return { valid: true };
  }
  
  const str = String(value).trim();
  
  if (str.length < minLength) {
    return { valid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }
  
  if (str.length > maxLength) {
    return { valid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }
  
  return { valid: true };
}

// Boolean validation
export function validateBoolean(value: any, fieldName: string, required: boolean = false): ValidationResult {
  if (value === undefined || value === null) {
    if (required) return { valid: false, error: `${fieldName} is required` };
    return { valid: true };
  }
  
  if (typeof value !== 'boolean') {
    return { valid: false, error: `${fieldName} must be a boolean` };
  }
  
  return { valid: true };
}

// Number validation
export function validateNumber(
  value: any,
  fieldName: string,
  options: { required?: boolean; min?: number; max?: number } = {}
): ValidationResult {
  const { required = false, min, max } = options;
  
  if (value === undefined || value === null || value === '') {
    if (required) return { valid: false, error: `${fieldName} is required` };
    return { valid: true };
  }
  
  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }
  
  if (min !== undefined && num < min) {
    return { valid: false, error: `${fieldName} must be at least ${min}` };
  }
  
  if (max !== undefined && num > max) {
    return { valid: false, error: `${fieldName} must be at most ${max}` };
  }
  
  return { valid: true };
}

// Enum validation
export function validateEnum(
  value: any, 
  fieldName: string, 
  allowedValues: string[], 
  required: boolean = false
): ValidationResult {
  if (!value) {
    if (required) return { valid: false, error: `${fieldName} is required` };
    return { valid: true };
  }
  
  if (!allowedValues.includes(String(value))) {
    return { 
      valid: false, 
      error: `${fieldName} must be one of: ${allowedValues.join(', ')}` 
    };
  }
  
  return { valid: true };
}

// IP address validation
export function validateIP(ip: any, required: boolean = false): ValidationResult {
  if (!ip || ip === 'unknown') {
    if (required && ip !== 'unknown') {
      return { valid: false, error: "IP address is required" };
    }
    return { valid: true };
  }
  
  const ipStr = String(ip).trim();
  
  // Allow "unknown" as a valid IP when extraction fails
  if (ipStr === 'unknown') return { valid: true };
  
  // IPv4 validation with proper octet range (0-255)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ipStr.match(ipv4Regex);
  if (ipv4Match) {
    const octets = [
      parseInt(ipv4Match[1]),
      parseInt(ipv4Match[2]),
      parseInt(ipv4Match[3]),
      parseInt(ipv4Match[4])
    ];
    if (octets.every(octet => octet >= 0 && octet <= 255)) {
      return { valid: true };
    }
  }
  
  // IPv6 validation (simplified)
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::1|::)$/;
  if (ipv6Regex.test(ipStr)) {
    return { valid: true };
  }
  
  return { valid: false, error: "Invalid IP address format" };
}

// Array validation
export function validateArray(
  value: any,
  fieldName: string,
  options: { required?: boolean; minLength?: number; maxLength?: number } = {}
): ValidationResult {
  const { required = false, minLength, maxLength } = options;
  
  if (!value) {
    if (required) return { valid: false, error: `${fieldName} is required` };
    return { valid: true };
  }
  
  if (!Array.isArray(value)) {
    return { valid: false, error: `${fieldName} must be an array` };
  }
  
  if (minLength !== undefined && value.length < minLength) {
    return { valid: false, error: `${fieldName} must have at least ${minLength} items` };
  }
  
  if (maxLength !== undefined && value.length > maxLength) {
    return { valid: false, error: `${fieldName} must have at most ${maxLength} items` };
  }
  
  return { valid: true };
}

/**
 * Validate US state abbreviation
 * @param state - Two-letter state code
 * @param fieldName - Name of the field being validated
 * @param required - Whether the field is required
 * @returns ValidationResult
 */
export function validateState(
  state: any,
  fieldName: string = 'state',
  required: boolean = true
): ValidationResult {
  if (!state || state === '') {
    return required 
      ? { valid: false, error: `${fieldName} is required` }
      : { valid: true };
  }
  
  if (typeof state !== 'string') {
    return { valid: false, error: `${fieldName} must be a string` };
  }
  
  // Must be exactly 2 uppercase letters
  if (!/^[A-Z]{2}$/.test(state)) {
    return { valid: false, error: `${fieldName} must be a valid 2-letter US state code` };
  }
  
  // Validate against list of actual US states
  const validStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC' // Include DC
  ];
  
  if (!validStates.includes(state)) {
    return { valid: false, error: `${fieldName} must be a valid US state` };
  }
  
  return { valid: true };
}

// Composite validator - runs multiple validations and returns all errors
export function validateInput(validations: ValidationResult[]): { valid: boolean; errors: string[] } {
  const errors = validations
    .filter(v => !v.valid)
    .map(v => v.error!)
    .filter(Boolean);
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Export password generator utility
export { generateSecurePassword } from './passwordGenerator.ts';
