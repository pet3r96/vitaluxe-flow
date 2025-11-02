/**
 * Formats patient email for display, replacing technical placeholders with user-friendly text
 */
export function formatPatientEmail(email: string | null | undefined): string {
  if (!email) return "Not entered";
  
  // Check if it's a placeholder email from migration
  if (email.match(/^no-email-[a-f0-9-]+@pending\.local$/i)) {
    return "Not entered";
  }
  
  return email;
}

/**
 * Checks if an email is a placeholder (not a real email)
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return /^no-email-[a-f0-9-]+@pending\.local$/i.test(email);
}
