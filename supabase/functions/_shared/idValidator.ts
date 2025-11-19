/**
 * PHASE 3 - PART 2: ID VALIDATION MIDDLEWARE
 * 
 * Validates that UUIDs are valid format and users own the resources they're accessing
 */

import { edgeLogger } from './logger.ts';

/**
 * Helper function to get user's practice_id
 * Checks both profiles table (for practice owners/providers) and practice_staff table (for staff)
 */
async function getUserPracticeId(supabase: any, userId: string): Promise<string | null> {
  // Check profiles first (practice owners, providers)
  const { data: profile } = await supabase
    .from('profiles')
    .select('practice_id')
    .eq('id', userId)
    .single();
  
  if (profile?.practice_id) return profile.practice_id;
  
  // Check practice_staff (staff members)
  const { data: staffRecord } = await supabase
    .from('practice_staff')
    .select('practice_id')
    .eq('user_id', userId)
    .eq('active', true)
    .single();
  
  return staffRecord?.practice_id || null;
}

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
        // Check if user belongs to the practice (supports both direct practice_id and staff)
        const userPracticeId = await getUserPracticeId(supabase, userId);
        
        const valid = userPracticeId === resourceId;
        return { 
          valid, 
          error: valid ? undefined : 'User does not belong to this practice',
          practiceId: userPracticeId || undefined
        };
      }

      case 'provider': {
        // Check if provider belongs to user's practice (supports staff users)
        const { data: provider } = await supabase
          .from('providers')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const userPracticeId = await getUserPracticeId(supabase, userId);
        
        const valid = provider?.practice_id === userPracticeId && userPracticeId !== null;
        return { 
          valid, 
          error: valid ? undefined : 'Provider does not belong to your practice',
          practiceId: userPracticeId || undefined
        };
      }

      case 'patient': {
        // FIRST: Check if user is admin or super_admin
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        const roles = userRoles?.map((r: { role: string }) => r.role) || [];
        const isAdmin = roles.includes('super_admin') || roles.includes('admin');

        if (isAdmin) {
          edgeLogger.info('Admin access granted for patient validation', { userId, patientId: resourceId });
          return { valid: true };
        }

        // SECOND: Check for active impersonation
        const { data: impersonation } = await supabase
          .from('active_impersonation_sessions')
          .select('impersonated_user_id, impersonated_role')
          .eq('admin_user_id', userId)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (impersonation) {
          const impersonatedId = impersonation.impersonated_user_id;
          edgeLogger.info('Using impersonated context for validation', { 
            adminId: userId, 
            impersonatedId,
            role: impersonation.impersonated_role 
          });
          userId = impersonatedId;
        }

        // THIRD: Standard practice check
        const { data: patient } = await supabase
          .from('patient_accounts')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const userPracticeId = await getUserPracticeId(supabase, userId);
        
        const valid = patient?.practice_id === userPracticeId && userPracticeId !== null;
        return { 
          valid, 
          error: valid ? undefined : 'Patient does not belong to your practice',
          practiceId: userPracticeId || undefined
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
        // Check if order belongs to user's practice OR if user is a topline/downline rep who can access it
        
        // Get the order with both practice_id and doctor_id
        const { data: order } = await supabase
          .from('orders')
          .select('practice_id, doctor_id')
          .eq('id', resourceId)
          .single();
        
        if (!order) {
          return { valid: false, error: 'Order not found' };
        }
        
        // Check if user has a practice_id (supports staff users)
        const userPracticeId = await getUserPracticeId(supabase, userId);
        
        // Check if user is the practice this order belongs to
        if (userPracticeId && order.practice_id === userPracticeId) {
          return { valid: true, practiceId: userPracticeId };
        }
        
        // Check if user is a topline rep who manages this practice
        const { data: toplineRep } = await supabase
          .from('reps')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'topline')
          .single();
        
        if (toplineRep) {
          // Check if the order's practice is linked to this topline
          const { data: practiceProfile } = await supabase
            .from('profiles')
            .select('linked_topline_id')
            .eq('id', order.doctor_id)
            .single();
          
          if (practiceProfile?.linked_topline_id === userId) {
            return { valid: true, practiceId: order.practice_id };
          }
        }
        
        // Check if user is a downline rep
        const { data: downlineRep } = await supabase
          .from('reps')
          .select('assigned_topline_id, reps!reps_assigned_topline_id_fkey(user_id)')
          .eq('user_id', userId)
          .eq('role', 'downline')
          .single();
        
        if (downlineRep && downlineRep.reps) {
          const toplineUserId = (downlineRep.reps as any).user_id;
          
          // Check if the order's practice is linked to this downline's topline
          const { data: practiceProfile } = await supabase
            .from('profiles')
            .select('linked_topline_id')
            .eq('id', order.doctor_id)
            .single();
          
          if (practiceProfile?.linked_topline_id === toplineUserId) {
            return { valid: true, practiceId: order.practice_id };
          }
        }
        
        return { 
          valid: false, 
          error: 'Order does not belong to your practice',
          practiceId: userPracticeId || undefined
        };
      }

      case 'prescription': {
        // Check if prescription belongs to user's practice (supports staff users)
        const { data: prescription } = await supabase
          .from('prescriptions')
          .select('practice_id')
          .eq('id', resourceId)
          .single();
        
        const userPracticeId = await getUserPracticeId(supabase, userId);
        
        const valid = prescription?.practice_id === userPracticeId && userPracticeId !== null;
        return { 
          valid, 
          error: valid ? undefined : 'Prescription does not belong to your practice',
          practiceId: userPracticeId || undefined
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
