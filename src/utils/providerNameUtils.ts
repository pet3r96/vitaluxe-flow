/**
 * Utility functions for consistent provider name display across the application
 */

/**
 * Derives a name from an email address (local part before @)
 * Converts to Title Case
 */
function deriveNameFromEmail(email: string): string {
  if (!email) return '';
  
  const localPart = email.split('@')[0];
  // Convert to Title Case
  return localPart
    .split(/[._-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Gets a display name for a provider with robust fallbacks
 * Priority: prescriber_name > full_name > name (if not email) > derived from email > "Provider"
 */
export function getProviderDisplayName(provider: any): string {
  if (!provider) return 'Provider';
  
  // Direct fields
  if (provider.prescriber_name?.trim()) {
    return provider.prescriber_name.trim();
  }
  
  if (provider.full_name?.trim()) {
    return provider.full_name.trim();
  }
  
  // Check for name field (but skip if it's an email)
  if (provider.name?.trim() && !provider.name.includes('@')) {
    return provider.name.trim();
  }
  
  // Try profiles object
  if (provider.profiles) {
    if (provider.profiles.prescriber_name?.trim()) {
      return provider.profiles.prescriber_name.trim();
    }
    
    if (provider.profiles.full_name?.trim()) {
      return provider.profiles.full_name.trim();
    }
    
    if (provider.profiles.name?.trim() && !provider.profiles.name.includes('@')) {
      return provider.profiles.name.trim();
    }
    
    // Derive from email if available
    if (provider.profiles.email) {
      const derived = deriveNameFromEmail(provider.profiles.email);
      if (derived) return derived;
    }
  }
  
  // Try user object (nested)
  if (provider.user) {
    if (provider.user.prescriber_name?.trim()) {
      return provider.user.prescriber_name.trim();
    }
    
    if (provider.user.full_name?.trim()) {
      return provider.user.full_name.trim();
    }
    
    if (provider.user.name?.trim() && !provider.user.name.includes('@')) {
      return provider.user.name.trim();
    }
  }
  
  // Try to construct from first/last name
  if (provider.first_name || provider.last_name) {
    const parts = [provider.first_name, provider.last_name].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ').trim();
    }
  }
  
  // Last resort: derive from email if we have it
  const email = provider.email || provider.profiles?.email;
  if (email) {
    const derived = deriveNameFromEmail(email);
    if (derived) return derived;
  }
  
  return 'Provider';
}

/**
 * Gets display name with email suffix for disambiguation in tables
 * Used when multiple providers have the same display name
 */
export function getProviderDisplayNameWithEmailSuffix(provider: any): string {
  const displayName = getProviderDisplayName(provider);
  const email = provider.profiles?.email || provider.email;
  
  if (email && email.includes('@')) {
    const emailPrefix = email.split('@')[0];
    return `${displayName} (${emailPrefix})`;
  }
  
  return displayName;
}

/**
 * Gets first and last name from provider data
 * Returns [firstName, lastName]
 */
export function getProviderNames(provider: any): [string, string] {
  if (!provider) return ['Provider', ''];
  
  // Try direct fields first
  if (provider.first_name && provider.last_name) {
    return [provider.first_name.trim(), provider.last_name.trim()];
  }
  
  // Try to split display name
  const displayName = getProviderDisplayName(provider);
  const parts = displayName.split(' ');
  
  if (parts.length === 1) {
    return [parts[0], ''];
  }
  
  return [parts[0], parts.slice(1).join(' ')];
}
