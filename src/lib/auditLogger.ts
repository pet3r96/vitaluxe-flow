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
