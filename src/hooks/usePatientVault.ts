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
      console.log('[usePatientVault] Fetching vault data for patient:', patientAccountId);
      
      const { data, error } = await supabase.functions.invoke('get-patient-vault-data', {
        body: { patient_account_id: patientAccountId }
      });
      
      if (error) {
        console.error('[usePatientVault] Error from edge function:', error);
        throw new Error(`Failed to load patient data: ${error.message}`);
      }
      
      if (!data || !data.patient) {
        console.error('[usePatientVault] No patient data returned');
        throw new Error('Patient data not found');
      }
      
      console.log('[usePatientVault] Successfully loaded patient data');
      return data.patient;
    },
    enabled: !!patientAccountId,
    retry: 1,
  });
}
