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
  edgeLogger.info('[ID_VALIDATOR] Resolving practice_id', { userId });
  
  // Check user_roles to determine role type
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  const roles = userRoles?.map((r: { role: string }) => r.role) || [];
  edgeLogger.info('[ID_VALIDATOR] User roles found', { userId, roles });
  
  // ✅ PHARMACY FIX: If user is a pharmacy, they don't have a practice_id
  if (roles.includes('pharmacy')) {
    edgeLogger.info('[ID_VALIDATOR] User is pharmacy, no practice_id', { userId });
    return null;
  }
  
  // If user is a doctor (practice owner), their user_id IS their practice_id
  if (roles.includes('doctor')) {
    edgeLogger.info('[ID_VALIDATOR] User is doctor, practice_id = user_id', { userId });
    return userId;
  }
  
  // If user is a provider, check providers table
  if (roles.includes('provider')) {
    const { data: provider, error } = await supabase
      .from('providers')
      .select('practice_id, active')
      .eq('user_id', userId)
      .eq('active', true)
      .maybeSingle();
    
    edgeLogger.info('[ID_VALIDATOR] Provider lookup', { 
      userId, 
      found: !!provider,
      practice_id: provider?.practice_id,
      active: provider?.active,
      error: error?.message
    });
    
    if (provider?.practice_id) return provider.practice_id;
  }
  
  // If user is a patient, check patient_accounts table
  if (roles.includes('patient')) {
    const { data: patient, error } = await supabase
      .from('patient_accounts')
      .select('practice_id')
      .eq('user_id', userId)
      .maybeSingle();

    edgeLogger.info('[ID_VALIDATOR] Patient lookup', {
      userId,
      found: !!patient,
      practice_id: patient?.practice_id,
      error: error?.message
    });

    if (patient?.practice_id) return patient.practice_id;
  }
  
  // If user is staff, check practice_staff table
  const { data: staffRecord, error } = await supabase
    .from('practice_staff')
    .select('practice_id, active')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  
  edgeLogger.info('[ID_VALIDATOR] Staff lookup', { 
    userId, 
    found: !!staffRecord,
    practice_id: staffRecord?.practice_id,
    active: staffRecord?.active,
    error: error?.message
  });
  
  const result = staffRecord?.practice_id || null;
  edgeLogger.info('[ID_VALIDATOR] Final practice_id', { userId, practice_id: result });
  
  return result;
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
        // ✅ ADMIN FIX: Check if user is admin or super_admin FIRST
        const { data: adminRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        const roles = adminRoles?.map((r: { role: string }) => r.role) || [];
        const isAdmin = roles.includes('super_admin') || roles.includes('admin');

        if (isAdmin) {
          edgeLogger.info('Admin access granted for order validation', { userId, orderId: resourceId });
          return { valid: true };
        }

        // ✅ PHARMACY FIX: Check if user is a pharmacy
        const { data: pharmacyData } = await supabase
          .from('pharmacies')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (pharmacyData) {
          // User is a pharmacy - check if they're assigned to this order
          edgeLogger.info('[ID_VALIDATOR] Pharmacy user detected, checking order assignment', { 
            userId, 
            pharmacyId: pharmacyData.id,
            orderId: resourceId 
          });
          
          const { data: assignedLines } = await supabase
            .from('order_lines')
            .select('id')
            .eq('order_id', resourceId)
            .eq('assigned_pharmacy_id', pharmacyData.id)
            .limit(1);
          
          const isAssigned = !!assignedLines && assignedLines.length > 0;
          edgeLogger.info('[ID_VALIDATOR] Pharmacy order check result', { 
            isAssigned,
            orderId: resourceId,
            pharmacyId: pharmacyData.id
          });
          
          return {
            valid: isAssigned,
            error: isAssigned ? undefined : 'Order not assigned to your pharmacy'
          };
        }
        
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
        // Check BOTH practice_id and doctor_id since orders use doctor_id as primary practice reference
        if (userPracticeId && (order.practice_id === userPracticeId || order.doctor_id === userPracticeId)) {
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
