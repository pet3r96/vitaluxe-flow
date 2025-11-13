import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAdminClient();

    const { practiceId, oldStatus, newStatus } = await req.json();

    console.log('[NotifyPatients] Subscription changed:', { practiceId, oldStatus, newStatus });

    // Only notify when going from active → inactive
    const wasActive = ['trial', 'active', 'suspended'].includes(oldStatus);
    const nowInactive = ['cancelled', 'expired', 'payment_failed'].includes(newStatus);

    if (!wasActive || !nowInactive) {
      console.log('[NotifyPatients] No notification needed (status change not significant)');
      return new Response(JSON.stringify({ message: 'No notification needed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get practice info
    const { data: practice } = await supabaseClient
      .from('profiles')
      .select('name')
      .eq('id', practiceId)
      .single();

    const practiceName = practice?.name || 'Your practice';

    // Get all patients for this practice
    const { data: patients, error: patientsError } = await supabaseClient
      .from('patient_accounts')
      .select('id, user_id, first_name, last_name')
      .eq('practice_id', practiceId);

    if (patientsError) {
      console.error('[NotifyPatients] Error fetching patients:', patientsError);
      throw patientsError;
    }

    console.log(`[NotifyPatients] Found ${patients?.length || 0} patients to notify`);

    let notificationCount = 0;

    // Send notification to each patient
    for (const patient of patients || []) {
      try {
        const { error: notifError } = await supabaseClient.functions.invoke('handleNotifications', {
          body: {
            user_id: patient.user_id,
            notification_type: 'subscription_alert',
            title: 'Practice Subscription Status Update',
            message: `${practiceName}'s subscription is currently inactive. Appointment booking and some features are temporarily unavailable. Please contact your practice for more information.`,
            metadata: {
              practiceId,
              practiceName,
              subscriptionStatus: newStatus,
              notificationType: 'practice_subscription_inactive'
            }
          }
        });

        if (notifError) {
          console.error('[NotifyPatients] Error creating notification for patient', patient.id, notifError);
        } else {
          notificationCount++;
          console.log(`[NotifyPatients] Notified patient ${patient.id} (${patient.first_name} ${patient.last_name})`);
        }
      } catch (error) {
        console.error('[NotifyPatients] Error processing patient', patient.id, error);
      }
    }

    console.log(`[NotifyPatients] Successfully notified ${notificationCount} patients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        patientsNotified: notificationCount,
        totalPatients: patients?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[NotifyPatients] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
