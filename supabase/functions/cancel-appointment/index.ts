import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { appointmentId } = await req.json();
    console.log('🔍 [cancel-appointment] Starting cancellation:', { appointmentId, authUserId: user.id });

    // Check for active impersonation session
    let effectiveUserId = user.id;
    const { data: impersonationSession, error: impersonationError } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impersonationError) {
      console.warn('⚠️ [cancel-appointment] Impersonation check failed (continuing as normal user):', impersonationError.message);
    } else if (impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      console.log('👥 [cancel-appointment] Impersonation detected:', { 
        adminUserId: user.id, 
        effectiveUserId 
      });
    }

    console.log('✅ [cancel-appointment] Using effective user ID:', effectiveUserId);

    // First get patient_account for the effective user
    const { data: patientAccount, error: paError } = await supabaseClient
      .from('patient_accounts')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('👤 [cancel-appointment] Patient account lookup:', { 
      effectiveUserId, 
      patientAccountId: patientAccount?.id,
      hasError: !!paError 
    });

    if (paError) {
      console.error('❌ [cancel-appointment] Patient account error:', paError);
      throw new Error('Patient account lookup failed: ' + paError.message);
    }

    if (!patientAccount) {
      console.error('❌ [cancel-appointment] No patient account found for user:', effectiveUserId);
      throw new Error('Patient account not found');
    }

    // Then verify appointment belongs to this patient
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('id, patient_id, status')
      .eq('id', appointmentId)
      .eq('patient_id', patientAccount.id)
      .maybeSingle();

    console.log('📅 [cancel-appointment] Appointment verification:', { 
      appointmentId,
      found: !!appointment,
      currentStatus: appointment?.status,
      belongsToPatient: appointment?.patient_id === patientAccount.id,
      fetchError: fetchError?.message 
    });

    // Handle idempotent cases
    if (fetchError) {
      console.error('❌ [cancel-appointment] Appointment fetch error:', fetchError);
      throw new Error('Appointment fetch failed: ' + fetchError.message);
    }

    if (!appointment) {
      console.log('ℹ️ [cancel-appointment] Appointment not found (may already be cancelled or deleted)');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Appointment already cancelled or not found',
        idempotent: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If already cancelled, return success (idempotent)
    if (appointment.status === 'cancelled') {
      console.log('ℹ️ [cancel-appointment] Appointment already cancelled');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Appointment already cancelled',
        idempotent: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform the cancellation
    console.log('✅ [cancel-appointment] Updating appointment status to cancelled');
    const { error } = await supabaseClient
      .from('patient_appointments')
      .update({ 
        status: 'cancelled', 
        updated_at: new Date().toISOString(), 
        cancelled_at: new Date().toISOString() 
      })
      .eq('id', appointmentId);

    if (error) {
      console.error('❌ [cancel-appointment] Update error:', error);
      throw error;
    }

    console.log('✅ [cancel-appointment] Appointment cancelled successfully');

    // If this is a video appointment, also update the video_session status
    const { data: videoSession } = await supabaseClient
      .from('video_sessions')
      .select('id, status')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (videoSession && videoSession.status !== 'ended') {
      console.log('🎥 [cancel-appointment] Also cancelling associated video session:', videoSession.id);
      
      await supabaseClient
        .from('video_sessions')
        .update({
          status: 'ended',
          actual_end_time: new Date().toISOString()
        })
        .eq('id', videoSession.id);

      // Log the cancellation
      await supabaseClient.from('video_session_logs').insert({
        session_id: videoSession.id,
        event_type: 'session_cancelled',
        user_id: user.id,
        user_type: 'provider',
        event_data: { reason: 'appointment_cancelled' }
      });
      
      console.log('✅ [cancel-appointment] Video session also cancelled');
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
