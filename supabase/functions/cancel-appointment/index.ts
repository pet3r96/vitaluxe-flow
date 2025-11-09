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

    // Service role client for operations that need to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
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

    // Check if user is a patient (use admin client to bypass RLS)
    const { data: patientAccount } = await supabaseAdmin
      .from('patient_accounts')
      .select('id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    // Check if user is a provider (use admin client to bypass RLS)
    const { data: providerAccount } = await supabaseAdmin
      .from('providers')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    // Check if user is staff (use admin client to bypass RLS)
    const { data: staffAccount } = await supabaseAdmin
      .from('practice_staff')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('👤 [cancel-appointment] User role lookup:', { 
      effectiveUserId,
      isPatient: !!patientAccount,
      isProvider: !!providerAccount,
      isStaff: !!staffAccount
    });

    let appointment;
    let fetchError;

    if (patientAccount) {
      // Patient cancelling their own appointment
      const result = await supabaseAdmin
        .from('patient_appointments')
        .select('id, patient_id, status, practice_id')
        .eq('id', appointmentId)
        .eq('patient_id', patientAccount.id)
        .maybeSingle();
      
      appointment = result.data;
      fetchError = result.error;
    } else if (providerAccount || staffAccount) {
      // Provider/staff cancelling any appointment in their practice
      const practiceId = providerAccount?.practice_id || staffAccount?.practice_id;
      
      const result = await supabaseAdmin
        .from('patient_appointments')
        .select('id, patient_id, status, practice_id')
        .eq('id', appointmentId)
        .eq('practice_id', practiceId)
        .maybeSingle();
      
      appointment = result.data;
      fetchError = result.error;
    } else {
      // Check if effectiveUserId is a practice itself (stored in profiles table)
      // Practice admins can cancel any appointment in their practice
      const result = await supabaseAdmin
        .from('patient_appointments')
        .select('id, patient_id, status, practice_id')
        .eq('id', appointmentId)
        .eq('practice_id', effectiveUserId)
        .maybeSingle();
      
      appointment = result.data;
      fetchError = result.error;

      if (!appointment) {
        console.error('❌ [cancel-appointment] User has no valid role and is not the practice owner');
        throw new Error('Unauthorized: User does not have permission to cancel appointments');
      }

      console.log('✅ [cancel-appointment] Practice admin cancelling appointment');
    }

    console.log('📅 [cancel-appointment] Appointment verification:', { 
      appointmentId,
      found: !!appointment,
      currentStatus: appointment?.status,
      belongsToPatient: patientAccount ? appointment?.patient_id === patientAccount.id : false,
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

    // Track if appointment was already cancelled for idempotent response
    let appointmentWasAlreadyCancelled = false;
    
    // Update appointment status if not already cancelled
    if (appointment.status === 'cancelled') {
      appointmentWasAlreadyCancelled = true;
      console.log('ℹ️ [cancel-appointment] Appointment already cancelled, will check video session');
    } else {
      // Perform the cancellation (use admin client to bypass RLS)
      console.log('✅ [cancel-appointment] Updating appointment status to cancelled');
      const { error } = await supabaseAdmin
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
    }

    // ALWAYS check and update video session status (even if appointment was already cancelled)
    // This ensures video sessions are synchronized with their appointments
    // Use admin client to bypass RLS since impersonation affects RLS policies
    const { data: videoSession } = await supabaseAdmin
      .from('video_sessions')
      .select('id, status')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    let videoSessionUpdated = false;
    if (videoSession && videoSession.status !== 'ended') {
      console.log('🎥 [cancel-appointment] Updating video session to ended:', videoSession.id);
      const { error: vsError } = await supabaseAdmin
        .from('video_sessions')
        .update({
          status: 'ended'
        })
        .eq('id', videoSession.id);

      if (vsError) {
        console.error('❌ [cancel-appointment] Video session update error:', vsError);
        throw new Error('Video session update failed: ' + vsError.message);
      }
      // Log the cancellation (use admin client to ensure it persists)
      await supabaseAdmin.from('video_session_logs').insert({
        session_id: videoSession.id,
        event_type: 'session_cancelled',
        user_id: user.id,
        user_type: 'provider',
        event_data: { reason: 'appointment_cancelled' }
      });
      
      videoSessionUpdated = true;
      console.log('✅ [cancel-appointment] Video session also cancelled');
    } else if (videoSession) {
      console.log('ℹ️ [cancel-appointment] Video session already ended');
    }

    return new Response(JSON.stringify({ 
      success: true,
      idempotent: appointmentWasAlreadyCancelled,
      videoSessionUpdated
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
