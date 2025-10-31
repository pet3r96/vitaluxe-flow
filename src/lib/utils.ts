import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ENCRYPTED placeholder utilities
export const ENCRYPTED_PLACEHOLDER = "[ENCRYPTED]";

export function sanitizeEncrypted(value?: string | null): string {
  // Treat [ENCRYPTED] placeholder as empty string for display
  if (value === ENCRYPTED_PLACEHOLDER) return "";
  // Treat null, undefined, or empty string as empty string
  if (!value || value.trim() === "") return "";
  return value;
}
