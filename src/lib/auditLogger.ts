import { supabase } from "@/integrations/supabase/client";

export interface PatientPHIAccessLog {
  patientId: string;
  patientName: string;
  accessedFields: {
    allergies?: boolean;
    notes?: boolean;
    address?: boolean;
  };
  viewerRole: string;
  relationship: 'practice_admin' | 'provider' | 'admin';
  componentContext: string;
}

/**
 * HIPAA Compliance: Log access to patient PHI (allergies, notes, address)
 * This function should be called whenever patient PHI is displayed to users
 */
export async function logPatientPHIAccess(params: PatientPHIAccessLog): Promise<void> {
  try {
    // Call database RPC function to securely log the access
    const { error } = await supabase.rpc('log_patient_phi_access', {
      p_patient_id: params.patientId,
      p_patient_name: params.patientName,
      p_accessed_fields: params.accessedFields,
      p_viewer_role: params.viewerRole,
      p_relationship: params.relationship,
      p_component_context: params.componentContext,
    });

    if (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Failed to log patient PHI access', error);
      });
    }
  } catch (error) {
    // Silent fail - don't block UI for logging errors
    import('@/lib/logger').then(({ logger }) => {
      logger.error('Patient PHI access logging error', error);
    });
  }
}

export interface SuspiciousAccessLog {
  userId: string;
  attemptedPracticeId: string;
  userPracticeId: string;
  resource: string;
  details?: Record<string, any>;
}

/**
 * SECURITY: Log suspicious cross-practice access attempts
 * This function should be called when client-side validation detects potential data leaks
 */
export async function logSuspiciousAccess(params: SuspiciousAccessLog): Promise<void> {
  try {
    const { error } = await supabase.from('audit_logs').insert({
      action_type: 'suspicious_cross_practice_access',
      entity_type: params.resource,
      details: {
        user_id: params.userId,
        attempted_practice: params.attemptedPracticeId,
        user_practice: params.userPracticeId,
        timestamp: new Date().toISOString(),
        ...params.details,
      }
    });

    if (error) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error('Failed to log suspicious access', error);
      });
    }
  } catch (error) {
    import('@/lib/logger').then(({ logger }) => {
      logger.error('Suspicious access logging error', error);
    });
  }
}
