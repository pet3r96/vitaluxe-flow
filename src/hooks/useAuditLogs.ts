import { useQuery } from "@tanstack/react-query";

export interface AuditLog {
  id: string;
  patient_account_id: string;
  action_type: 'created' | 'updated' | 'deleted' | 'pre_intake_completed';
  entity_type: 'medication' | 'condition' | 'allergy' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'demographics' | 'pre_intake_form' | 'document';
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

// Phase 6: medical_vault_audit_logs table was dropped - audit logging disabled
export const useAuditLogs = (patientAccountId?: string) => {
  return useQuery({
    queryKey: ["medical-vault-audit-logs", patientAccountId],
    queryFn: async () => {
      console.log('[useAuditLogs] Audit logging disabled - table dropped in Phase 6');
      return [];
    },
    enabled: false, // Disabled - table no longer exists
  });
};

// Phase 6: medical_vault_audit_logs table was dropped - audit logging disabled
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
  entityType: 'medication' | 'condition' | 'allergy' | 'vital' | 'immunization' | 'surgery' | 'pharmacy' | 'emergency_contact' | 'demographics' | 'pre_intake_form' | 'document';
  entityId?: string;
  entityName?: string;
  changedByUserId?: string;
  changedByRole?: 'patient' | 'doctor' | 'staff' | 'provider';
  oldData?: any;
  newData?: any;
  changeSummary?: string;
}) => {
  // No-op: audit logging disabled after Phase 6 cleanup
  console.log('[logMedicalVaultChange] Audit logging disabled - table dropped in Phase 6');
};
