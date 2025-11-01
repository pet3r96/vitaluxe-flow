import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditLog {
  id: string;
  patient_account_id: string;
  action_type: 'created' | 'updated' | 'deleted' | 'pre_intake_completed';
  entity_type: 'medication' | 'condition' | 'allergy' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'demographics' | 'pre_intake_form';
  entity_id?: string;
  entity_name?: string;
  changed_by_user_id?: string;
  changed_by_role?: 'patient' | 'doctor' | 'staff' | 'provider';
  old_data?: any;
  new_data?: any;
  change_summary?: string;
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
      if (!patientAccountId) return [];

      const { data, error } = await supabase
        .from("medical_vault_audit_logs")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !!patientAccountId,
  });
};

// Utility function to log changes
export const logMedicalVaultChange = async ({
  patientAccountId,
  actionType,
  entityType,
  entityId,
  entityName,
  changedByUserId,
  changedByRole,
  oldData,
  newData,
  changeSummary,
}: {
  patientAccountId: string;
  actionType: 'created' | 'updated' | 'deleted' | 'pre_intake_completed';
  entityType: 'medication' | 'condition' | 'allergy' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'demographics' | 'pre_intake_form';
  entityId?: string;
  entityName?: string;
  changedByUserId?: string;
  changedByRole?: 'patient' | 'doctor' | 'staff' | 'provider';
  oldData?: any;
  newData?: any;
  changeSummary?: string;
}) => {
  try {
    const { error } = await supabase
      .from("medical_vault_audit_logs")
      .insert({
        patient_account_id: patientAccountId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        changed_by_user_id: changedByUserId,
        changed_by_role: changedByRole,
        old_data: oldData,
        new_data: newData,
        change_summary: changeSummary,
      });

    if (error) {
      console.error("Error logging medical vault change:", error);
    }
  } catch (error) {
    console.error("Error logging medical vault change:", error);
  }
};
