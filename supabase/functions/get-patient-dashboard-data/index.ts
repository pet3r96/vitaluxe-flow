import { createAuthClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DashboardData {
  patientAccount: any;
  medicalVault: any;
  nextAppointment: any;
  unreadMessagesCount: number;
  recentAppointments: any[];
  recentMessages: any[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[get-patient-dashboard-data] 🚀 Starting batched dashboard fetch');
    
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    // Get user from JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('[get-patient-dashboard-data] ❌ Auth error:', userError);
      throw new Error('Unauthorized');
    }

    console.log('[get-patient-dashboard-data] 👤 User ID:', user.id);

    // Fetch all data in parallel
    const [
      patientAccountRes,
    ] = await Promise.all([
      // 1. Patient account
      supabaseClient
        .from('patient_accounts')
        .select('id, first_name, last_name, practice_id, user_id, email, birth_date, address_street, address_city, address_state, address_zip, address_formatted, gender_at_birth, intake_completed_at')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    if (patientAccountRes.error) {
      console.error('[get-patient-dashboard-data] ❌ Patient account error:', patientAccountRes.error);
      throw patientAccountRes.error;
    }

    const patientAccount = patientAccountRes.data;
    if (!patientAccount) {
      console.error('[get-patient-dashboard-data] ❌ No patient account found');
      throw new Error('Patient account not found');
    }

    console.log('[get-patient-dashboard-data] ✅ Patient account:', patientAccount.id);

    // Now fetch all dependent data in parallel
    const [
      medicationsRes,
      allergiesRes,
      conditionsRes,
      surgeriesRes,
      immunizationsRes,
      vitalsRes,
      pharmaciesRes,
      emergencyContactsRes,
      vaultRes,
      nextAppointmentRes,
      unreadMessagesRes,
      recentAppointmentsRes,
      recentMessagesRes,
    ] = await Promise.all([
      // Medical vault data (8 queries)
      supabaseClient
        .from('patient_medications')
        .select('id')
        .eq('patient_account_id', patientAccount.id)
        .eq('is_active', true),
      supabaseClient
        .from('patient_allergies')
        .select('id')
        .eq('patient_account_id', patientAccount.id)
        .eq('is_active', true),
      supabaseClient
        .from('patient_conditions')
        .select('id')
        .eq('patient_account_id', patientAccount.id)
        .eq('is_active', true),
      supabaseClient
        .from('patient_surgeries')
        .select('id')
        .eq('patient_account_id', patientAccount.id),
      supabaseClient
        .from('patient_immunizations')
        .select('id')
        .eq('patient_account_id', patientAccount.id),
      supabaseClient
        .from('patient_vitals')
        .select('id')
        .eq('patient_account_id', patientAccount.id),
      supabaseClient
        .from('patient_pharmacies')
        .select('id')
        .eq('patient_account_id', patientAccount.id),
      supabaseClient
        .from('patient_emergency_contacts')
        .select('id')
        .eq('patient_account_id', patientAccount.id),
      supabaseClient
        .from('patient_medical_vault')
        .select('id, blood_type, updated_at')
        .eq('patient_id', patientAccount.id)
        .maybeSingle(),
      // Next appointment
      supabaseClient
        .from('patient_appointments')
        .select('id, start_time, end_time, visit_type, status, practice_id, provider_id')
        .eq('patient_id', patientAccount.id)
        .gte('start_time', new Date().toISOString())
        .in('status', ['scheduled', 'pending', 'confirmed'])
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle(),
      // Unread messages count
      supabaseClient
        .from('patient_messages')
        .select('id')
        .eq('patient_id', patientAccount.id)
        .eq('sender_type', 'provider')
        .is('read_at', null)
        .eq('resolved', false),
      // Recent appointments
      supabaseClient
        .from('patient_appointments')
        .select('id, start_time, end_time, status, visit_summary_url, practice_id, provider_id')
        .eq('patient_id', patientAccount.id)
        .lt('start_time', new Date().toISOString())
        .in('status', ['scheduled', 'completed', 'cancelled', 'no_show'])
        .order('start_time', { ascending: false })
        .limit(3),
      // Recent messages
      supabaseClient
        .from('patient_messages')
        .select('id, thread_id, subject, message_body, created_at, read_at, sender_type')
        .eq('patient_id', patientAccount.id)
        .order('created_at', { ascending: false }),
    ]);

    // Process medical vault counts
    const medicationsCount = medicationsRes.data?.length || 0;
    const allergiesCount = allergiesRes.data?.length || 0;
    const conditionsCount = conditionsRes.data?.length || 0;
    const surgeriesCount = surgeriesRes.data?.length || 0;
    const immunizationsCount = immunizationsRes.data?.length || 0;
    const vitalsCount = vitalsRes.data?.length || 0;
    const pharmaciesCount = pharmaciesRes.data?.length || 0;
    const emergencyContactsCount = emergencyContactsRes.data?.length || 0;

    const has_data = medicationsCount > 0 || allergiesCount > 0 || conditionsCount > 0 ||
                     surgeriesCount > 0 || immunizationsCount > 0 || vitalsCount > 0 ||
                     pharmaciesCount > 0 || emergencyContactsCount > 0 || !!vaultRes.data?.blood_type;

    const medicalVault = {
      id: vaultRes.data?.id,
      blood_type: vaultRes.data?.blood_type,
      updated_at: vaultRes.data?.updated_at,
      medications_count: medicationsCount,
      allergies_count: allergiesCount,
      conditions_count: conditionsCount,
      surgeries_count: surgeriesCount,
      immunizations_count: immunizationsCount,
      vitals_count: vitalsCount,
      pharmacies_count: pharmaciesCount,
      emergency_contacts_count: emergencyContactsCount,
      has_data,
    };

    // Process next appointment - fetch practice branding if appointment exists
    let nextAppointment = null;
    if (nextAppointmentRes.data) {
      const { data: branding } = await supabaseClient
        .from('practice_branding')
        .select('practice_name')
        .eq('practice_id', nextAppointmentRes.data.practice_id)
        .maybeSingle();

      nextAppointment = {
        ...nextAppointmentRes.data,
        practice: { name: branding?.practice_name || 'Practice' },
      };
    }

    // Process recent appointments - fetch practice brandings
    let recentAppointments: any[] = [];
    if (recentAppointmentsRes.data && recentAppointmentsRes.data.length > 0) {
      const practiceIds = Array.from(new Set(recentAppointmentsRes.data.map(a => a.practice_id)));
      const { data: brandings } = await supabaseClient
        .from('practice_branding')
        .select('practice_id, practice_name')
        .in('practice_id', practiceIds);

      recentAppointments = recentAppointmentsRes.data.map(appt => ({
        ...appt,
        practice: {
          name: brandings?.find((b: any) => b.practice_id === appt.practice_id)?.practice_name || 'Practice',
        },
      }));
    }

    // Process recent messages - get latest by thread
    let recentMessages: any[] = [];
    if (recentMessagesRes.data && recentMessagesRes.data.length > 0) {
      const latestByThread = new Map();
      recentMessagesRes.data.forEach((m: any) => {
        const key = m.thread_id || m.id;
        const existing = latestByThread.get(key);
        if (!existing || new Date(m.created_at).getTime() > new Date(existing.created_at).getTime()) {
          latestByThread.set(key, m);
        }
      });

      recentMessages = Array.from(latestByThread.values())
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3)
        .map((m: any) => ({
          id: m.thread_id || m.id,
          subject: m.subject,
          message_body: m.message_body,
          created_at: m.created_at,
          read_at: m.read_at,
          sender: { name: m.sender_type === 'provider' ? 'Provider' : 'You' },
        }));
    }

    const unreadMessagesCount = unreadMessagesRes.data?.length || 0;

    const dashboardData: DashboardData = {
      patientAccount,
      medicalVault,
      nextAppointment,
      unreadMessagesCount,
      recentAppointments,
      recentMessages,
    };

    console.log('[get-patient-dashboard-data] ✅ Successfully fetched all dashboard data');

    return new Response(
      JSON.stringify(dashboardData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[get-patient-dashboard-data] ❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
