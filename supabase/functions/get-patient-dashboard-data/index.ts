import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient, createAuthClient } from "../_shared/supabaseAdmin.ts";
import { cacheFetch } from "../_shared/cache.ts";
import { isAdmin as checkIsAdmin } from '../_shared/roleChecker.ts';
import { RateLimiter, getClientIP } from '../_shared/rateLimiter.ts';
import { validateRequestSize } from '../_shared/requestSizeValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const sizeValidation = validateRequestSize(req, 'get-patient-dashboard-data', corsHeaders);
  if (sizeValidation) return sizeValidation;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseAuth = createAuthClient(authHeader);

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const supabase = createAdminClient();
    const limiter = new RateLimiter();
    const { allowed } = await limiter.checkLimit(
      supabase,
      getClientIP(req),
      'get-patient-dashboard-data',
      { maxRequests: 30, windowSeconds: 3600 }
    );

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { effectiveUserId } = await req.json();
    if (!effectiveUserId) {
      throw new Error('effectiveUserId is required');
    }

    const isAdmin = await checkIsAdmin(supabaseAuth, user.id);
    
    if (!isAdmin && user.id !== effectiveUserId) {
      throw new Error('Unauthorized: Cannot access other user data');
    }

    const cacheKey = `patient_dashboard:${effectiveUserId}`;
    
    const dashboardData = await cacheFetch(
      cacheKey,
      async () => {
        console.log('[get-patient-dashboard-data] Cache miss - fetching data for user', effectiveUserId);
        
        // 1. Get patient account with full details
        const { data: patientAccount, error: accountError } = await supabase
          .from('patient_accounts')
          .select('id, first_name, last_name, practice_id, user_id, email, birth_date, address_street, address_city, address_state, address_zip, address_formatted, gender_at_birth, intake_completed_at')
          .eq('user_id', effectiveUserId)
          .single();

        if (accountError || !patientAccount) {
          throw new Error('Patient account not found');
        }

        // 2. Get next upcoming appointment
        const { data: nextAppointment, error: nextApptError } = await supabase
          .from('patient_appointments')
          .select('id, start_time, end_time, visit_type, status, practice_id, provider_id')
          .eq('patient_id', patientAccount.id)
          .gte('start_time', new Date().toISOString())
          .neq('status', 'cancelled')
          .order('start_time', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextApptError) {
          console.error('[get-patient-dashboard-data] Error fetching next appointment', nextApptError);
        }

        // Get practice name for next appointment
        let nextAppointmentWithPractice = null;
        if (nextAppointment) {
          const { data: practice } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', nextAppointment.practice_id)
            .maybeSingle();
          
          nextAppointmentWithPractice = {
            ...nextAppointment,
            practice: { name: practice?.name || 'Practice' }
          };
        }

        // 3. Get unread messages count
        const { data: unreadMessages, error: unreadError } = await supabase
          .from('patient_messages')
          .select('id', { count: 'exact', head: true })
          .eq('patient_id', patientAccount.id)
          .is('read_at', null)
          .eq('sender_type', 'practice');

        if (unreadError) {
          console.error('[get-patient-dashboard-data] Error counting unread messages', unreadError);
        }

        const unreadMessagesCount = unreadMessages || 0;

        // 4. Get medical vault counts using new RPC
        const { data: vaultCounts, error: vaultError } = await supabase
          .rpc('get_patient_vault_counts', {
            p_patient_account_id: patientAccount.id
          });

        if (vaultError) {
          console.error('[get-patient-dashboard-data] Error fetching vault counts', vaultError);
        }

        const medicalVault = {
          medications_count: vaultCounts?.medications_count || 0,
          allergies_count: vaultCounts?.allergies_count || 0,
          conditions_count: vaultCounts?.conditions_count || 0,
          surgeries_count: vaultCounts?.surgeries_count || 0,
          immunizations_count: vaultCounts?.immunizations_count || 0,
          vitals_count: vaultCounts?.vitals_count || 0,
          pharmacies_count: vaultCounts?.pharmacies_count || 0,
          emergency_contacts_count: vaultCounts?.emergency_contacts_count || 0,
          has_data: (
            (vaultCounts?.medications_count || 0) > 0 ||
            (vaultCounts?.allergies_count || 0) > 0 ||
            (vaultCounts?.conditions_count || 0) > 0 ||
            (vaultCounts?.surgeries_count || 0) > 0 ||
            (vaultCounts?.immunizations_count || 0) > 0 ||
            (vaultCounts?.vitals_count || 0) > 0 ||
            (vaultCounts?.pharmacies_count || 0) > 0 ||
            (vaultCounts?.emergency_contacts_count || 0) > 0
          )
        };

        // 5. Get recent appointments (last 5)
        const { data: recentAppointments, error: recentApptError } = await supabase
          .from('patient_appointments')
          .select('id, start_time, end_time, status, visit_summary_url, practice_id, provider_id')
          .eq('patient_id', patientAccount.id)
          .order('start_time', { ascending: false })
          .limit(5);

        if (recentApptError) {
          console.error('[get-patient-dashboard-data] Error fetching recent appointments', recentApptError);
        }

        // Get practice names for recent appointments
        const recentAppointmentsWithPractice = await Promise.all(
          (recentAppointments || []).map(async (appt) => {
            const { data: practice } = await supabase
              .from('profiles')
              .select('name')
              .eq('id', appt.practice_id)
              .maybeSingle();
            
            return {
              ...appt,
              practice: { name: practice?.name || 'Practice' }
            };
          })
        );

        // 6. Get recent messages (last 5 root messages)
        const { data: recentMessages, error: recentMsgError } = await supabase
          .from('patient_messages')
          .select('id, subject, body, created_at, read_at, sender_type, practice_id')
          .eq('patient_id', patientAccount.id)
          .is('parent_message_id', null)
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentMsgError) {
          console.error('[get-patient-dashboard-data] Error fetching recent messages', recentMsgError);
        }

        // Format messages with sender info
        const recentMessagesFormatted = (recentMessages || []).map(msg => ({
          id: msg.id,
          subject: msg.subject,
          body: msg.body,
          created_at: msg.created_at,
          read_at: msg.read_at,
          sender: {
            name: msg.sender_type === 'patient' ? 'You' : 'Practice'
          }
        }));

        // Log final structure for debugging
        console.log('[get-patient-dashboard-data] FINAL RETURN STRUCTURE', {
          hasPatientAccount: !!patientAccount,
          patientFirstName: patientAccount?.first_name,
          patientLastName: patientAccount?.last_name,
          vaultHasData: medicalVault.has_data,
          vaultMedsCount: medicalVault.medications_count,
          vaultAllergiesCount: medicalVault.allergies_count,
          vaultConditionsCount: medicalVault.conditions_count,
          nextApptExists: !!nextAppointmentWithPractice,
          recentApptCount: recentAppointmentsWithPractice.length,
          recentMsgCount: recentMessagesFormatted.length,
          unreadCount: unreadMessagesCount
        });

        // Return data matching PatientDashboardData interface
        return {
          patientAccount,
          medicalVault,
          nextAppointment: nextAppointmentWithPractice,
          unreadMessagesCount,
          recentAppointments: recentAppointmentsWithPractice,
          recentMessages: recentMessagesFormatted
        };
      },
      120 // 120 seconds TTL
    );

    return new Response(
      JSON.stringify(dashboardData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-patient-dashboard-data] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});