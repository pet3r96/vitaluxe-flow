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

    console.log('[get-patient-dashboard-data] 👤 Admin User ID:', user.id);

    // Check for active impersonation session
    const { data: impersonationSession } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id, impersonated_role')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .maybeSingle();

    const effectiveUserId = impersonationSession?.impersonated_user_id || user.id;
    const effectiveRole = impersonationSession?.impersonated_role || null;

    console.log('[get-patient-dashboard-data] 🎭 Effective User ID:', effectiveUserId);
    console.log('[get-patient-dashboard-data] 🎭 Effective Role:', effectiveRole);

    // If user is not a patient, return an empty dashboard payload gracefully
    const { data: rolesData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', effectiveUserId);

    const isPatient = Array.isArray(rolesData) && rolesData.some((r: any) => r.role === 'patient');
    if (!isPatient) {
      console.log('[get-pient-dashboard-data] ℹ️ User is not a patient; returning empty payload');
      const emptyPayload: DashboardData = {
        patientAccount: null,
        medicalVault: {
          medications_count: 0,
          allergies_count: 0,
          conditions_count: 0,
          surgeries_count: 0,
          immunizations_count: 0,
          vitals_count: 0,
          pharmacies_count: 0,
          emergency_contacts_count: 0,
          has_data: false,
        },
        nextAppointment: null,
        unreadMessagesCount: 0,
        recentAppointments: [],
        recentMessages: [],
      };
      return new Response(
        JSON.stringify(emptyPayload),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all data in parallel
    const [
      patientAccountRes,
    ] = await Promise.all([
      // 1. Patient account
      supabaseClient
        .from('patient_accounts')
        .select('id, first_name, last_name, practice_id, user_id, email, birth_date, address_street, address_city, address_state, address_zip, address_formatted, gender_at_birth, intake_completed_at')
        .eq('user_id', effectiveUserId)
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
      vaultRes,
      nextAppointmentRes,
      unreadMessagesRes,
      recentAppointmentsRes,
      recentMessagesRes,
    ] = await Promise.all([
      // Medical vault data - query consolidated patient_medical_vault table
      supabaseClient
        .from('patient_medical_vault')
        .select('id, record_type')
        .eq('patient_id', patientAccount.id),
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

    // Process medical vault data from consolidated table
    const vaultRecords = vaultRes.data || [];
    const medicationsCount = vaultRecords.filter((r: any) => r.record_type === 'medication').length;
    const allergiesCount = vaultRecords.filter((r: any) => r.record_type === 'allergy').length;
    const conditionsCount = vaultRecords.filter((r: any) => r.record_type === 'condition').length;
    const surgeriesCount = vaultRecords.filter((r: any) => r.record_type === 'surgery').length;
    const immunizationsCount = vaultRecords.filter((r: any) => r.record_type === 'immunization').length;
    const vitalsCount = vaultRecords.filter((r: any) => r.record_type === 'vital_signs').length;
    const documentsCount = vaultRecords.filter((r: any) => r.record_type === 'document').length;

    const has_data = vaultRecords.length > 0;

    const medicalVault = {
      medications_count: medicationsCount,
      allergies_count: allergiesCount,
      conditions_count: conditionsCount,
      surgeries_count: surgeriesCount,
      immunizations_count: immunizationsCount,
      vitals_count: vitalsCount,
      documents_count: documentsCount,
      has_data,
    };

    // Process next appointment - fetch practice branding if appointment exists
    let nextAppointment = null;
    if (nextAppointmentRes?.data) {
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
    if (recentAppointmentsRes?.data && recentAppointmentsRes.data.length > 0) {
      const practiceIds = Array.from(new Set(recentAppointmentsRes.data.map((a: any) => a.practice_id)));
      const { data: brandings } = await supabaseClient
        .from('practice_branding')
        .select('practice_id, practice_name')
        .in('practice_id', practiceIds);

      recentAppointments = recentAppointmentsRes.data.map((appt: any) => ({
        ...appt,
        practice: {
          name: brandings?.find((b: any) => b.practice_id === appt.practice_id)?.practice_name || 'Practice',
        },
      }));
    }

    // Process recent messages - get latest by thread
    let recentMessages: any[] = [];
    if (recentMessagesRes?.data && recentMessagesRes.data.length > 0) {
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

    const unreadMessagesCount = unreadMessagesRes?.data?.length || 0;

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
