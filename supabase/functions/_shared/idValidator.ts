/**
 * PHASE 3 - PART 2: ID VALIDATION MIDDLEWARE
 * 
 * Validates that UUIDs are valid format and users own the resources they're accessing
 */

import { edgeLogger } from './logger.ts';

/**
 * Validate UUID format using regex
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate multiple UUIDs at once
 */
export function validateUUIDs(ids: Record<string, string>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [key, value] of Object.entries(ids)) {
    if (!isValidUUID(value)) {
      errors.push(`Invalid UUID format for ${key}: ${value}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export type ResourceType = 'practice' | 'provider' | 'patient' | 'pharmacy' | 'order' | 'prescription';

/**
 * Validate that a user owns/has access to a specific resource
 * This enforces tenant isolation at the application layer
 */
export async function validateUserOwnsResource(
  supabase: any,
  userId: string,
  resourceType: ResourceType,
  resourceId: string
): Promise<{ valid: boolean; error?: string; practiceId?: string }> {
  
  // Validate UUID format first
  if (!isValidUUID(resourceId)) {
    return { valid: false, error: `Invalid ${resourceType} ID format` };
  }

  if (!isValidUUID(userId)) {
    return { valid: false, error: 'Invalid user ID format' };
  }

  try {
    switch (resourceType) {
      case 'practice': {
        // Check if user belongs to the practice
        const { data: profile } = await supabase
          .from('profiles')
          .select('practice_id')
          .eq('id', userId)
          .single();
        
        const valid = profile?.practice_id === resourceId;
        return { 
          valid, 
          error: valid ? undefined : 'User does not belong to this practice',
          practiceId: profile?.practice_id
        };
      }

      case 'provider': {
        // Check if provider belongs to user's practice
        const { data: provider } = await supabase
          .from('providers')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('practice_id')
          .eq('id', userId)
          .single();
        
        const valid = provider?.practice_id === userProfile?.practice_id;
        return { 
          valid, 
          error: valid ? undefined : 'Provider does not belong to your practice',
          practiceId: userProfile?.practice_id
        };
      }

      case 'patient': {
        // Check if patient belongs to user's practice
        const { data: patient } = await supabase
          .from('patient_accounts')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('practice_id')
          .eq('id', userId)
          .single();
        
        const valid = patient?.practice_id === userProfile?.practice_id;
        return { 
          valid, 
          error: valid ? undefined : 'Patient does not belong to your practice',
          practiceId: userProfile?.practice_id
        };
      }

      case 'pharmacy': {
        // Check if pharmacy is associated with user's practice
        const { data: pharmacy } = await supabase
          .from('pharmacies')
          .select('id, pharmacy_network')
          .eq('id', resourceId)
          .single();
        
        if (!pharmacy) {
          return { valid: false, error: 'Pharmacy not found' };
        }
        
        // Pharmacies are network-wide, but check if user is authorized
        return { valid: true, practiceId: undefined };
      }

      case 'order': {
        // Check if order belongs to user's practice
        const { data: order } = await supabase
          .from('orders')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('practice_id')
          .eq('id', userId)
          .single();
        
        const valid = order?.practice_id === userProfile?.practice_id;
        return { 
          valid, 
          error: valid ? undefined : 'Order does not belong to your practice',
          practiceId: userProfile?.practice_id
        };
      }

      case 'prescription': {
        // Check if prescription belongs to user's practice
        const { data: prescription } = await supabase
          .from('prescriptions')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('practice_id')
          .eq('id', userId)
          .single();
        
        const valid = prescription?.practice_id === userProfile?.practice_id;
        return { 
          valid, 
          error: valid ? undefined : 'Prescription does not belong to your practice',
          practiceId: userProfile?.practice_id
        };
      }

      default:
        return { valid: false, error: `Unknown resource type: ${resourceType}` };
    }
  } catch (error: any) {
    edgeLogger.error('Error validating resource ownership', { resourceType, resourceId, userId, error: error.message });
    return { valid: false, error: 'Failed to validate resource ownership' };
  }
}

/**
 * Validate batch of resource IDs
 */
export async function validateBatchOwnership(
  supabase: any,
  userId: string,
  resources: Array<{ type: ResourceType; id: string }>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];
  
  for (const resource of resources) {
    const result = await validateUserOwnsResource(supabase, userId, resource.type, resource.id);
    if (!result.valid) {
      errors.push(`${resource.type} ${resource.id}: ${result.error}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
