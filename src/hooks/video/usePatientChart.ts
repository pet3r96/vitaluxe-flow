import { useState, useCallback } from "react";
import { usePatientChartData } from "@/hooks/usePatientChartData";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface UsePatientChartReturn {
  chart: any;
  loading: boolean;
  refresh: () => Promise<void>;
  addNote: (content: string, type: string) => Promise<void>;
  updateVital: (vital: any) => Promise<void>;
  addDocument: (file: File, type: string) => Promise<void>;
  hasUnreadUpdates: boolean;
  lastUpdateTimestamp: Date | null;
}

export const usePatientChart = (patientId: string): UsePatientChartReturn => {
  const { chart, loading, refresh } = usePatientChartData(patientId);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<Date | null>(null);
  const [hasUnreadUpdates, setHasUnreadUpdates] = useState(false);

  // Add note to patient chart
  const addNote = useCallback(async (content: string, type: string = "general") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Get practice_id from patient_accounts
      const { data: patientAccount } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", patientId)
        .single();
      
      if (!patientAccount) throw new Error("Patient account not found");
      
      const { error } = await supabase
        .from("patient_medical_vault")
        .insert({
          patient_account_id: patientId,
          patient_id: patientId,
          practice_id: patientAccount.practice_id,
          record_type: 'note',
          title: `${type.charAt(0).toUpperCase() + type.slice(1)} Note`,
          record_data: {
            note_content: content,
            note_type: type,
            created_by_user_id: user?.id || '',
            created_by_name: user?.email || 'Unknown',
            created_by_role: 'provider',
            created_at: new Date().toISOString(),
          },
        });

      if (error) throw error;
      
      setLastUpdateTimestamp(new Date());
      setHasUnreadUpdates(true);
      await refresh();
    } catch (error) {
      logger.error("Failed to add note to patient chart", error, { patientId });
      throw error;
    }
  }, [patientId, refresh]);

  // Update vital signs
  const updateVital = useCallback(async (vital: any) => {
    try {
      // Get practice_id from patient_accounts
      const { data: patientAccount } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", patientId)
        .single();
      
      if (!patientAccount) throw new Error("Patient account not found");
      
      // JUSTIFIED: patient_medical_vault table uses JSONB record_data field
      const { error } = await supabase
        .from("patient_medical_vault")
        .insert([{
          patient_account_id: patientId,
          patient_id: patientId,
          practice_id: patientAccount.practice_id,
          record_type: "vital",
          title: "Vital Signs",
          record_data: vital,
          date_recorded: new Date().toISOString(),
        }] as any);

      if (error) throw error;
      
      setLastUpdateTimestamp(new Date());
      setHasUnreadUpdates(true);
      await refresh();
    } catch (error) {
      logger.error("Failed to update vital signs", error, { patientId });
      throw error;
    }
  }, [patientId, refresh]);

  // Add document to patient chart
  const addDocument = useCallback(async (file: File, type: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Upload file to storage
      const filePath = `${patientId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("patient-documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("patient-documents")
        .getPublicUrl(filePath);

      // Get practice_id from patient_accounts
      const { data: patientAccount } = await supabase
        .from("patient_accounts")
        .select("practice_id")
        .eq("id", patientId)
        .single();
      
      if (!patientAccount) throw new Error("Patient account not found");

      // Save document record
      const { error } = await supabase
        .from("patient_medical_vault")
        .insert({
          patient_account_id: patientId,
          patient_id: patientId,
          practice_id: patientAccount.practice_id,
          record_type: 'document',
          title: file.name,
          record_data: {
            document_type: type,
            document_name: file.name,
            storage_path: filePath,
            url: publicUrl,
            uploaded_by: user?.id,
            uploaded_at: new Date().toISOString(),
          },
        });

      if (error) throw error;
      
      setLastUpdateTimestamp(new Date());
      setHasUnreadUpdates(true);
      await refresh();
    } catch (error) {
      logger.error("Failed to add document to patient chart", error, { patientId });
      throw error;
    }
  }, [patientId, refresh]);

  return {
    chart,
    loading,
    refresh,
    addNote,
    updateVital,
    addDocument,
    hasUnreadUpdates,
    lastUpdateTimestamp,
  };
};
