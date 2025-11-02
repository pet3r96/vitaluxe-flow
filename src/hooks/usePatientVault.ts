import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Centralized hook for fetching patient vault data
 * Uses get-patient-vault-data edge function to bypass RLS
 */
export function usePatientVault(patientAccountId?: string) {
  return useQuery({
    queryKey: ["patient-vault", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-patient-vault-data', {
        body: { patient_account_id: patientAccountId }
      });
      
      if (error) throw error;
      return data?.patient;
    },
    enabled: !!patientAccountId,
  });
}
