import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PatientIdentity {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  dob: string | null;
  gender: string | null;
}

export const usePatientChartData = (patientId: string) => {
  const [chart, setChart] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ---------------------------------------------
  // FETCH ALL PATIENT CHART TABLES
  // ---------------------------------------------
  const loadChart = async () => {
    setLoading(true);

    // Patient Identity
    const { data: patientData } = await supabase.from("patient_accounts").select("*").eq("id", patientId).single();

    const identity: PatientIdentity | null = patientData
      ? {
          id: patientData.id,
          fullName: `${patientData.first_name ?? ""} ${patientData.last_name ?? ""}`.trim(),
          email: patientData.email,
          phone: patientData.phone,
          dob: patientData.birth_date ?? patientData.date_of_birth ?? null,
          gender: patientData.gender_at_birth ?? null,
        }
      : null;

    // Fetch medical vault records
    const { data: vaultRecords } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientId)
      .order("created_at", { ascending: false });

    // Group by record type
    const medications = vaultRecords?.filter(r => r.record_type === 'medication') || [];
    const conditions = vaultRecords?.filter(r => r.record_type === 'condition') || [];
    const allergies = vaultRecords?.filter(r => r.record_type === 'allergy') || [];
    const vitals = vaultRecords?.filter(r => r.record_type === 'vital') || [];
    const immunizations = vaultRecords?.filter(r => r.record_type === 'immunization') || [];
    const surgeries = vaultRecords?.filter(r => r.record_type === 'surgery') || [];
    const pharmacies = vaultRecords?.filter(r => r.record_type === 'pharmacy') || [];
    const documents = vaultRecords?.filter(r => r.record_type === 'document') || [];
    
    // Fetch patient notes separately (if not in vault)
    // TODO: Remove (as any) when patient_notes is added to Supabase types  
    const { data: notes } = await (supabase as any)
      .from("patient_notes")
      .select("*")
      .eq("patient_account_id", patientId)
      .order("created_at", { ascending: false });

    setChart({
      patient: identity,
      vitals,
      medications,
      allergies,
      conditions,
      surgeries,
      immunizations,
      pharmacies,
      documents,
      notes: notes || [],
    });

    setLoading(false);
  };

  // initial load
  useEffect(() => {
    loadChart();
  }, [patientId]);

  // realtime updates
  useEffect(() => {
    const channels: any[] = [];

    const tables = [
      "patient_accounts",
      "patient_medical_vault",
      "patient_notes",
    ];

    for (const table of tables) {
      const filterField = table === "patient_accounts" ? "id" : "patient_account_id";

      const channel = supabase
        .channel(`${table}-${patientId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: `${filterField}=eq.${patientId}`,
          },
          () => {
            console.log(`[Realtime Update] ${table} changed → refreshing chart`);
            loadChart();
          },
        )
        .subscribe();

      channels.push(channel);
    }

    return () => {
      for (const ch of channels) {
        supabase.removeChannel(ch);
      }
    };
  }, [patientId]);

  return {
    chart,
    loading,
    refresh: loadChart,
  };
};
