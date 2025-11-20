import { z } from "zod";

/**
 * Phone Number Validation
 * Must be exactly 10 digits (no formatting characters)
 */
export const phoneSchema = z
  .string()
  .trim()
  .length(10, "Phone number must be exactly 10 digits")
  .regex(/^\d{10}$/, "Phone number must contain only numbers")
  .optional()
  .or(z.literal(""));

/**
 * NPI (National Provider Identifier) Validation
 * Must be exactly 10 digits
 */
export const npiSchema = z
  .string()
  .trim()
  .length(10, "NPI must be exactly 10 digits")
  .regex(/^\d{10}$/, "NPI must contain only numbers")
  .optional()
  .or(z.literal(""));

/**
 * DEA Number Validation
 * Format: 2 letters + 6 digits + 1 check digit
 * Examples: AB1234563, FP5678901
 */
export const deaSchema = z
  .string()
  .trim()
  .length(9, "DEA number must be exactly 9 characters")
  .regex(
    /^[A-Z]{2}\d{7}$/,
    "DEA number must be 2 uppercase letters followed by 7 digits"
  )
  .optional()
  .or(z.literal(""));

/**
 * Email Validation
 * Optional but must be valid email format if provided
 */
export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email format")
  .optional()
  .or(z.literal(""));

/**
 * Normalize phone number to exactly 10 digits
 * Removes formatting characters, country codes, extensions
 * Examples:
 *   "(561) 886-8226" → "5618868226"
 *   "+1 561-886-8226" → "5618868226"
 *   "1-561-886-8226" → "5618868226"
 */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  
  // Strip everything except digits
  let digits = input.replace(/\D/g, "");
  
  // Remove leading 1 (US country code)
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.substring(1);
  }
  
  return digits;
}

/**
 * Helper functions for programmatic validation
 */
export function validatePhone(
  phone: string | null | undefined,
  options?: { required?: boolean }
): { valid: boolean; error?: string } {
  // Normalize first
  const normalized = normalizePhone(phone);
  
  // If required and empty, fail
  if (options?.required && (!normalized || normalized === "")) {
    return { valid: false, error: "Phone number is required" };
  }
  
  // If optional and empty, pass
  if (!normalized || normalized === "") {
    return { valid: true };
  }
  
  // Must be exactly 10 digits
  if (normalized.length !== 10) {
    return { valid: false, error: "Phone number must be exactly 10 digits" };
  }
  
  // Must contain only numbers
  if (!/^\d{10}$/.test(normalized)) {
    return { valid: false, error: "Phone number must contain only numbers" };
  }
  
  return { valid: true };
}

export function validateNPI(npi: string | null | undefined): { valid: boolean; error?: string } {
  if (!npi || npi === "") return { valid: true };
  
  const result = npiSchema.safeParse(npi);
  return result.success 
    ? { valid: true } 
    : { valid: false, error: result.error.issues[0]?.message };
}

export function validateDEA(dea: string | null | undefined): { valid: boolean; error?: string } {
  if (!dea || dea === "") return { valid: true };
  
  const result = deaSchema.safeParse(dea);
  return result.success 
    ? { valid: true } 
    : { valid: false, error: result.error.issues[0]?.message };
}

export function validateEmail(email: string | null | undefined): { valid: boolean; error?: string } {
  if (!email || email === "") return { valid: true };
  
  const result = emailSchema.safeParse(email);
  return result.success 
    ? { valid: true } 
    : { valid: false, error: result.error.issues[0]?.message };
}

/**
 * Display phone number as raw 10 digits
 * Phone numbers are stored as exactly 10 digits (e.g., "5618868226")
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "-";
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");
  
  // Return raw 10 digits only
  return cleaned.length === 10 ? cleaned : phone;
}
