import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ENCRYPTED placeholder utilities
export const ENCRYPTED_PLACEHOLDER = "[ENCRYPTED]";

export function sanitizeEncrypted(value?: string | null): string {
  if (value === ENCRYPTED_PLACEHOLDER) return "";
  return value ?? "";
}
