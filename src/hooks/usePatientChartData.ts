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

    // Fetch all vault records for this patient from consolidated patient_medical_vault
    const { data: vaultData } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    const allRecords = vaultData ?? [];

    // Group records by record_type
    const groupByType = (type: string) => allRecords.filter(r => r.record_type === type);

    setChart({
      patient: identity,
      vitals: groupByType("vital_signs"),
      medications: groupByType("medication"),
      allergies: groupByType("allergy"),
      conditions: groupByType("condition"),
      surgeries: groupByType("surgery"),
      immunizations: groupByType("immunization"),
      documents: groupByType("document"),
      notes: groupByType("note"),
    });

    setLoading(false);
  };

  // initial load
  useEffect(() => {
    loadChart();
  }, [patientId]);

  // realtime updates for patient_accounts and patient_medical_vault
  useEffect(() => {
    const channels: any[] = [];

    // Listen to patient_accounts changes
    const accountsChannel = supabase
      .channel(`patient_accounts-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_accounts",
          filter: `id=eq.${patientId}`,
        },
        () => {
          console.log(`[Realtime Update] patient_accounts changed → refreshing chart`);
          loadChart();
        },
      )
      .subscribe();

    channels.push(accountsChannel);

    // Listen to patient_medical_vault changes
    const vaultChannel = supabase
      .channel(`patient_medical_vault-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patient_medical_vault",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          console.log(`[Realtime Update] patient_medical_vault changed → refreshing chart`);
          loadChart();
        },
      )
      .subscribe();

    channels.push(vaultChannel);

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
