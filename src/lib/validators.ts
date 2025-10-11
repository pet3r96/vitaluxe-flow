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
 * Helper functions for programmatic validation
 */
export function validatePhone(phone: string | null | undefined): { valid: boolean; error?: string } {
  if (!phone || phone === "") return { valid: true };
  
  const result = phoneSchema.safeParse(phone);
  return result.success 
    ? { valid: true } 
    : { valid: false, error: result.error.errors[0]?.message };
}

export function validateNPI(npi: string | null | undefined): { valid: boolean; error?: string } {
  if (!npi || npi === "") return { valid: true };
  
  const result = npiSchema.safeParse(npi);
  return result.success 
    ? { valid: true } 
    : { valid: false, error: result.error.errors[0]?.message };
}

export function validateDEA(dea: string | null | undefined): { valid: boolean; error?: string } {
  if (!dea || dea === "") return { valid: true };
  
  const result = deaSchema.safeParse(dea);
  return result.success 
    ? { valid: true } 
    : { valid: false, error: result.error.errors[0]?.message };
}
