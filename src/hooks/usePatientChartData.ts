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

    // Vault tables
    const vaultTables = [
      "patient_vitals",
      "patient_medications",
      "patient_allergies",
      "patient_conditions",
      "patient_surgeries",
      "patient_immunizations",
      "patient_pharmacies",
      "patient_documents",
      "patient_notes",
    ];

    const results: Record<string, any[]> = {};

    for (const table of vaultTables) {
      const { data } = await supabase
        .from(table as any)
        .select("*")
        .eq("patient_account_id", patientId)
        .order("created_at", { ascending: false });

      results[table] = data ?? [];
    }

    setChart({
      patient: identity,
      vitals: results.patient_vitals,
      medications: results.patient_medications,
      allergies: results.patient_allergies,
      conditions: results.patient_conditions,
      surgeries: results.patient_surgeries,
      immunizations: results.patient_immunizations,
      pharmacies: results.patient_pharmacies,
      documents: results.patient_documents,
      notes: results.patient_notes,
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
      "patient_vitals",
      "patient_medications",
      "patient_allergies",
      "patient_conditions",
      "patient_surgeries",
      "patient_immunizations",
      "patient_pharmacies",
      "patient_documents",
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
