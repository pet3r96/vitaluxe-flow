import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PatientDashboardData {
  patientAccount: {
    id: string;
    first_name: string;
    last_name: string;
    practice_id: string;
    user_id: string;
    email: string;
    birth_date: string;
    address_street: string;
    address_city: string;
    address_state: string;
    address_zip: string;
    address_formatted: string;
    gender_at_birth: string;
    intake_completed_at: string | null;
  };
  medicalVault: {
    id?: string;
    blood_type?: string;
    updated_at?: string;
    medications_count: number;
    allergies_count: number;
    conditions_count: number;
    surgeries_count: number;
    immunizations_count: number;
    vitals_count: number;
    pharmacies_count: number;
    emergency_contacts_count: number;
    has_data: boolean;
  };
  nextAppointment: {
    id: string;
    start_time: string;
    end_time: string;
    visit_type: string;
    status: string;
    practice_id: string;
    provider_id: string;
    practice: { name: string };
  } | null;
  unreadMessagesCount: number;
  recentAppointments: Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    visit_summary_url?: string;
    practice_id: string;
    provider_id: string;
    practice: { name: string };
  }>;
  recentMessages: Array<{
    id: string;
    subject: string;
    message_body: string;
    created_at: string;
    read_at: string | null;
    sender: { name: string };
  }>;
}

export function usePatientDashboard(effectiveUserId: string | null) {
  return useQuery({
    queryKey: ["patient-dashboard-data", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) throw new Error('No effective user ID');

      console.log('[usePatientDashboard] 🚀 Fetching batched dashboard data for user:', effectiveUserId);

      const { data, error } = await supabase.functions.invoke<PatientDashboardData>(
        'get-patient-dashboard-data',
        {
          method: 'POST',
        }
      );

      if (error) {
        console.error('[usePatientDashboard] ❌ Error:', error);
        throw error;
      }

      if (!data) {
        console.error('[usePatientDashboard] ❌ No data returned');
        throw new Error('No data returned from dashboard endpoint');
      }

      console.log('[usePatientDashboard] ✅ Successfully fetched batched dashboard data');
      return data;
    },
    enabled: !!effectiveUserId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });
}
