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

/**
 * Extract state with fallback to a direct state value
 * Useful for practice orders where we have both formatted address and separate state field
 * @param address - Formatted address string
 * @param fallbackState - Direct state code to use if extraction fails
 * @returns Two-letter state code or empty string if both methods fail
 */
export const extractStateWithFallback = (
  address: string | null | undefined,
  fallbackState?: string | null
): string => {
  const extracted = extractStateFromAddress(address);
  if (extracted) return extracted;
  
  // Fallback to direct state value if provided and valid
  if (fallbackState && /^[A-Z]{2}$/.test(fallbackState)) {
    return fallbackState;
  }
  
  return '';
};

/**
 * Validate that a state code is a valid 2-letter US state abbreviation
 * @param state - State code to validate
 * @returns True if valid, false otherwise
 */
export const isValidStateCode = (state: string | null | undefined): boolean => {
  if (!state || typeof state !== 'string') return false;
  return /^[A-Z]{2}$/.test(state);
};
