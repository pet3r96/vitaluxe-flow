import { supabase } from "@/integrations/supabase/client";

export interface CredentialAccessLog {
  profileId: string;
  profileName: string;
  accessedFields: {
    npi?: boolean;
    dea?: boolean;
    license?: boolean;
  };
  viewerRole: string;
  relationship: 'self' | 'practice_admin' | 'topline' | 'downline' | 'admin';
  componentContext: string;
}

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
 * HIPAA Compliance: Log access to sensitive credential fields (NPI, DEA, License)
 * This function should be called whenever these fields are displayed to users
 */
export async function logCredentialAccess(params: CredentialAccessLog): Promise<void> {
  try {
    // Call edge function to securely log the access
    const { error } = await supabase.functions.invoke('log-credential-access', {
      body: {
        profile_id: params.profileId,
        profile_name: params.profileName,
        accessed_fields: params.accessedFields,
        viewer_role: params.viewerRole,
        relationship: params.relationship,
        component_context: params.componentContext,
      }
    });

    if (error) {
      console.error('Failed to log credential access:', error);
    }
  } catch (error) {
    // Silent fail - don't block UI for logging errors
    console.error('Credential access logging error:', error);
  }
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
      console.error('Failed to log patient PHI access:', error);
    }
  } catch (error) {
    // Silent fail - don't block UI for logging errors
    console.error('Patient PHI access logging error:', error);
  }
}
