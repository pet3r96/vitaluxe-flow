/**
 * Address utility functions for extracting and validating address components
 */

/**
 * Extract state abbreviation from formatted address string
 * Supports formats like:
 * - "123 Main St, City, FL 12345"
 * - "Street Address, City, State ZIP"
 * @param address - Formatted address string
 * @returns Two-letter state code or empty string if not found
 */
export const extractStateFromAddress = (address: string | null | undefined): string => {
  if (!address) return '';
  
  // Extract state from address (2 uppercase letters before ZIP)
  const stateMatch = address.match(/,\s*([A-Z]{2})\s+\d{5}/);
  return stateMatch ? stateMatch[1] : '';
};
