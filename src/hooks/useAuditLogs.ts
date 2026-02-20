import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

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
        logger.info('[useAuditLogs] No patientAccountId provided');
        return [];
      }

      logger.info('[useAuditLogs] Fetching audit logs for', { patientAccountId });
      
      const { data, error} = await supabase
        .from("medical_vault_audit_logs")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("created_at", { ascending: false });

      if (error) {
        logger.error('[useAuditLogs] Query error', error);
        throw error;
      }
      
      logger.info('[useAuditLogs] Found entries', { count: data?.length || 0 });
      return data as AuditLog[];
    },
    enabled: !!patientAccountId,
    refetchOnMount: 'always',
  });
};

// Utility function to log changes
export const logMedicalVaultChange = async (params: {
  patientAccountId: string;
  practiceId?: string; // Optional - will be fetched if not provided
  actionType: 'created' | 'updated' | 'deleted' | 'soft_deleted' | 'restored' | 'pre_intake_completed';
  // New DB fields  
  recordId?: string;
  changedBy?: string;
  changeSummary?: string;
  previousValues?: any;
  newValues?: any;
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
    // Auto-fetch practice_id if not provided
    let practiceId = params.practiceId;
    if (!practiceId) {
      const { data } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", params.patientAccountId)
        .single();
      practiceId = data?.practice_id;
    }
    
    if (!practiceId) {
      logger.error("Cannot log vault change: practice_id not found", { patientAccountId: params.patientAccountId });
      return;
    }
    
    const { error } = await supabase.rpc('insert_medical_vault_audit_log', {
      p_patient_account_id: params.patientAccountId,
      p_practice_id: practiceId,
      p_action_type: params.actionType,
      p_record_id: params.recordId || params.entityId || null,
      p_changed_by: params.changedBy || params.changedByUserId || null,
      p_performed_by_user_id: params.changedBy || params.changedByUserId || null,
      p_change_summary: params.changeSummary || null,
      p_previous_values: params.previousValues || params.oldData || null,
      p_new_values: params.newValues || params.newData || null,
    });

    if (error) {
      logger.error("Error logging medical vault change", error);
    }
  } catch (error) {
    logger.error("Error logging medical vault change", error);
  }
};
