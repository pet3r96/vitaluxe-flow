/**
 * VIOS Helper Utilities
 * 
 * Common utility functions for VIOS API integration.
 */

/**
 * Convert UUID to a deterministic int32 for VIOS practiceId
 * 
 * VIOS requires practiceId as an int32, but our system uses UUIDs.
 * This function creates a consistent integer from a UUID by:
 * 1. Removing dashes from the UUID
 * 2. Taking the first 8 hex characters
 * 3. Converting to an integer within int32 range
 * 
 * The same UUID will always produce the same integer.
 * 
 * @param uuid - The UUID string to convert
 * @returns A consistent integer representation for VIOS practiceId
 * 
 * @example
 * uuidToViosPracticeId('28807c7e-5296-4860-b3a1-93c883dff39d')
 * // Returns: 681671806
 */
export function uuidToViosPracticeId(uuid: string): number {
  if (!uuid) {
    throw new Error('UUID is required for VIOS practice ID conversion');
  }
  
  // Remove dashes and take first 8 hex characters
  const hexPart = uuid.replace(/-/g, '').substring(0, 8);
  
  // Convert to integer, ensure within int32 range (max 2,147,483,647)
  const intValue = parseInt(hexPart, 16) % 2147483647;
  
  return intValue;
}

/**
 * Safely convert UUID to VIOS practice ID string
 * Returns undefined if UUID is not provided
 */
export function getViosPracticeIdFromUuid(uuid: string | null | undefined): string | undefined {
  if (!uuid) {
    return undefined;
  }
  return uuidToViosPracticeId(uuid).toString();
}
