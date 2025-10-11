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
  
  // Validate check digit
  const digits = cleaned.substring(2);
  const sum1 = parseInt(digits[0]) + parseInt(digits[2]) + parseInt(digits[4]);
  const sum2 = parseInt(digits[1]) + parseInt(digits[3]) + parseInt(digits[5]);
  const checkDigit = (sum1 + sum2 * 2) % 10;
  
  if (checkDigit !== parseInt(digits[6])) {
    return { valid: false, error: "Invalid DEA number check digit" };
  }
  
  return { valid: true };
}
