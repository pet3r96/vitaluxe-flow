/**
 * Provider utility functions for consistent provider name display
 */

/**
 * Extract provider display name from appointment provider data
 * Handles nested profiles structure and various fallbacks
 */
export function getProviderDisplayName(provider: any): string | null {
  if (!provider) return null;
  
  // If profiles data is nested (from SELECT query with join)
  if (provider.profiles?.full_name) {
    return provider.profiles.full_name;
  }
  
  if (provider.profiles?.prescriber_name) {
    return provider.profiles.prescriber_name;
  }
  
  if (provider.profiles?.name) {
    return provider.profiles.name;
  }
  
  // If full_name is at provider level (for compatibility with transformed data)
  if (provider.full_name) {
    return provider.full_name;
  }
  
  if (provider.prescriber_name) {
    return provider.prescriber_name;
  }
  
  if (provider.name) {
    return provider.name;
  }
  
  return null;
}
