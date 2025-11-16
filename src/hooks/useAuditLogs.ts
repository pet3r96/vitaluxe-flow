import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  patient_account_id: string;
  action_type: 'created' | 'updated' | 'deleted' | 'pre_intake_completed';
  // DB fields
  record_id?: string;
  changed_by?: string;
  change_summary?: string;
  // Legacy/virtual fields for backward compatibility
  entity_type?: 'medication' | 'condition' | 'allergy' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'demographics' | 'pre_intake_form' | 'document';
  entity_id?: string;
  entity_name?: string;
  changed_by_user_id?: string;
  changed_by_role?: 'patient' | 'doctor' | 'staff' | 'provider';
  old_data?: any;
  new_data?: any;
  created_at: string;
}

// Helper function to map effective role to audit log role
export const mapRoleToAuditRole = (effectiveRole: string | null): 'patient' | 'doctor' | 'staff' | 'provider' => {
  switch (effectiveRole) {
    case 'patient':
      return 'patient';
    case 'doctor':
      return 'doctor';
    case 'staff':
      return 'staff';
    case 'provider':
      return 'provider';
    case 'admin':
      return 'staff'; // Admins are treated as staff for audit purposes
    default:
      return 'patient'; // Default fallback
  }
};

export const useAuditLogs = (patientAccountId?: string) => {
  return useQuery({
    queryKey: ["medical-vault-audit-logs", patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) {
        console.log('[useAuditLogs] No patientAccountId provided');
        return [];
      }

      console.log('[useAuditLogs] Fetching audit logs for:', patientAccountId);
      
      const { data, error} = await supabase
        .from("medical_vault_audit_logs")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('[useAuditLogs] Query error:', error);
        throw error;
      }
      
      console.log('[useAuditLogs] Found entries:', data?.length || 0, 'entries');
      return data as AuditLog[];
    },
    enabled: !!patientAccountId,
    refetchOnMount: 'always',
  });
};

// Utility function to log changes
export const logMedicalVaultChange = async (params: {
  patientAccountId: string;
  actionType: 'created' | 'updated' | 'deleted' | 'pre_intake_completed';
  // New DB fields  
  recordId?: string;
  changedBy?: string;
  changeSummary?: string;
  // Legacy fields (ignored in DB insert, kept for backward compatibility)
  entityType?: string;
  entityId?: string;
  entityName?: string;
  changedByUserId?: string;
  changedByRole?: string;
  oldData?: any;
  newData?: any;
}) => {
  try {
    const { error } = await supabase
      .from("medical_vault_audit_logs")
      .insert({
        patient_account_id: params.patientAccountId,
        action_type: params.actionType,
        record_id: params.recordId || params.entityId,
        changed_by: params.changedBy || params.changedByUserId,
        change_summary: params.changeSummary,
      });

    if (error) {
      console.error("Error logging medical vault change:", error);
    }
  } catch (error) {
    console.error("Error logging medical vault change:", error);
  }
};
