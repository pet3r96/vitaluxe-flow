import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader) {
      console.error('❌ [complete-video-appointment] No auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized: missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAuth = createAuthClient(authHeader);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      console.error('❌ [complete-video-appointment] Auth failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ [complete-video-appointment] Authenticated user:', user.id);

    // Use service role client for database operations (bypass RLS)
    const supabaseClient = createAdminClient();

    const { appointmentId } = await req.json();

    if (!appointmentId) {
      return new Response(
        JSON.stringify({ error: 'Appointment ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✅ [complete-video-appointment] Completing appointment:', appointmentId);

    // Check for active impersonation
    const { data: impersonationData } = await supabaseClient
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    const effectiveUserId = impersonationData?.impersonated_user_id || user.id;

    console.log('👤 [complete-video-appointment] User check:', {
      authUserId: user.id,
      effectiveUserId,
      isImpersonating: !!impersonationData,
    });

    // Get appointment details
    const { data: appointment, error: appointmentError } = await supabaseClient
      .from('patient_appointments')
      .select('id, patient_id, provider_id, practice_id, status')
      .eq('id', appointmentId)
      .single();

    if (appointmentError || !appointment) {
      console.error('❌ [complete-video-appointment] Appointment not found:', appointmentError);
      return new Response(
        JSON.stringify({ error: 'Appointment not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify user has permission: provider, practice owner, or staff
    let isAuthorized = false;

    // Check if user is the provider
    const { data: provider } = await supabaseClient
      .from('providers')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    const isProvider = provider && appointment.provider_id === provider.id;
    
    // Check if user is practice owner
    const isPracticeOwner = appointment.practice_id === effectiveUserId;
    
    // Check if user is staff member
    const { data: staffMember } = await supabaseClient
      .from('practice_staff')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', appointment.practice_id)
      .eq('active', true)
      .maybeSingle();
    
    const isStaff = !!staffMember;

    isAuthorized = isProvider || isPracticeOwner || isStaff;

    console.log('🔐 [complete-video-appointment] Authorization:', {
      isProvider,
      isPracticeOwner,
      isStaff,
      isAuthorized,
      appointmentPracticeId: appointment.practice_id,
      effectiveUserId,
    });

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to complete this appointment. Only the provider, practice owner, or practice staff can complete appointments.' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Update appointment status to completed
    const { error: updateAppointmentError } = await supabaseClient
      .from('patient_appointments')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId);

    if (updateAppointmentError) {
      console.error('❌ [complete-video-appointment] Failed to update appointment:', updateAppointmentError);
      throw updateAppointmentError;
    }

    // End associated video session if exists
    const { data: videoSession } = await supabaseClient
      .from('video_sessions')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (videoSession) {
      const { error: endSessionError } = await supabaseClient
        .from('video_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
        })
        .eq('id', videoSession.id);

      if (endSessionError) {
        console.error('❌ [complete-video-appointment] Failed to end video session:', endSessionError);
      }

      // Log completion event
      await supabaseClient.from('video_session_logs').insert({
        session_id: videoSession.id,
        event_type: 'appointment_completed',
        user_type: 'provider',
        event_data: {
          completed_by: effectiveUserId,
          completed_at: new Date().toISOString(),
          appointment_id: appointmentId,
        },
      });
    }

    console.log('✅ [complete-video-appointment] Appointment completed successfully');

    return new Response(
      JSON.stringify({ success: true, message: 'Appointment completed successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('❌ [complete-video-appointment] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
