import { useState, useCallback } from "react";
import { usePatientChartData } from "@/hooks/usePatientChartData";
import { supabase } from "@/integrations/supabase/client";

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
      
      const { error } = await supabase
        .from("patient_notes")
        .insert({
          patient_account_id: patientId,
          note_content: content,
          created_by_user_id: user?.id || '',
          created_by_name: user?.email || 'Unknown',
          created_by_role: 'provider',
        });

      if (error) throw error;
      
      setLastUpdateTimestamp(new Date());
      setHasUnreadUpdates(true);
      await refresh();
    } catch (error) {
      console.error("[usePatientChart] Failed to add note:", error);
      throw error;
    }
  }, [patientId, refresh]);

  // Update vital signs
  const updateVital = useCallback(async (vital: any) => {
    try {
      const { error } = await supabase
        .from("patient_vitals")
        .insert({
          patient_account_id: patientId,
          ...vital,
        });

      if (error) throw error;
      
      setLastUpdateTimestamp(new Date());
      setHasUnreadUpdates(true);
      await refresh();
    } catch (error) {
      console.error("[usePatientChart] Failed to update vital:", error);
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

      // Save document record
      const { error } = await supabase
        .from("patient_documents")
        .insert({
          patient_id: patientId,
          document_type: type,
          document_name: file.name,
          storage_path: filePath,
          uploaded_by: user?.id,
        });

      if (error) throw error;
      
      setLastUpdateTimestamp(new Date());
      setHasUnreadUpdates(true);
      await refresh();
    } catch (error) {
      console.error("[usePatientChart] Failed to add document:", error);
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
