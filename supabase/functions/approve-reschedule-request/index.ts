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

    const { appointmentId, action, ignoreConflicts = true, cancelOriginal = false } = await req.json();

    if (!appointmentId || !action) {
      throw new Error('appointmentId and action are required');
    }

    if (!['move', 'duplicate'].includes(action)) {
      throw new Error('action must be "move" or "duplicate"');
    }

    console.log('Approve reschedule request:', { appointmentId, action, ignoreConflicts, cancelOriginal, userId: user.id });

    // Get user role and verify authorization
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRole || !['admin', 'provider'].includes(userRole.role)) {
      throw new Error('Only admins and providers can approve reschedule requests');
    }

    // Fetch the appointment with reschedule request details
    const { data: appointment, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('*, patient_accounts!inner(practice_id)')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointment) {
      throw new Error('Appointment not found');
    }

    if (!appointment.requested_date || !appointment.requested_time) {
      throw new Error('No reschedule request found for this appointment');
    }

    // Verify user has access to this practice
    const practiceId = appointment.patient_accounts.practice_id;
    
    if (userRole.role === 'provider') {
      const { data: provider } = await supabaseClient
        .from('practice_providers')
        .select('practice_id')
        .eq('user_id', user.id)
        .eq('practice_id', practiceId)
        .single();

      if (!provider) {
        throw new Error('Provider does not have access to this practice');
      }
    }

    // Calculate new start and end times
    const requestedDateTime = `${appointment.requested_date}T${appointment.requested_time}:00`;
    const newStartTime = new Date(requestedDateTime).toISOString();
    const duration = new Date(appointment.end_time).getTime() - new Date(appointment.start_time).getTime();
    const newEndTime = new Date(new Date(requestedDateTime).getTime() + duration).toISOString();

    console.log('Calculated times:', { newStartTime, newEndTime, duration });

    // Check for conflicts if not ignoring
    if (!ignoreConflicts) {
      const { data: conflicts } = await supabaseClient
        .from('patient_appointments')
        .select('id')
        .eq('provider_id', appointment.provider_id)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .or(`and(start_time.lt.${newEndTime},end_time.gt.${newStartTime})`)
        .neq('id', appointmentId);

      if (conflicts && conflicts.length > 0) {
        throw new Error('Time slot conflicts with existing appointments');
      }
    }

    if (action === 'move') {
      // Move the existing appointment to the new time
      const { data: updated, error: updateError } = await supabaseClient
        .from('patient_appointments')
        .update({
          start_time: newStartTime,
          end_time: newEndTime,
          status: 'confirmed',
          confirmation_type: 'confirmed',
          requested_date: null,
          requested_time: null,
          reschedule_reason: null,
          reschedule_requested_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId)
        .select()
        .single();

      if (updateError) throw updateError;

      console.log('Appointment moved successfully:', updated.id);

      return new Response(JSON.stringify({ success: true, appointment: updated, action: 'moved' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      // Create a new appointment with the requested time
      const { data: newAppointment, error: insertError } = await supabaseClient
        .from('patient_appointments')
        .insert({
          patient_id: appointment.patient_id,
          practice_id: appointment.practice_id,
          provider_id: appointment.provider_id,
          room_id: appointment.room_id,
          start_time: newStartTime,
          end_time: newEndTime,
          appointment_type: appointment.appointment_type,
          service_type_id: appointment.service_type_id,
          service_description: appointment.service_description,
          notes: appointment.notes,
          status: 'confirmed',
          confirmation_type: 'confirmed',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      console.log('New appointment created:', newAppointment.id);

      // Clear reschedule request from original appointment
      const { error: clearError } = await supabaseClient
        .from('patient_appointments')
        .update({
          requested_date: null,
          requested_time: null,
          reschedule_reason: null,
          reschedule_requested_at: null,
          status: cancelOriginal ? 'cancelled' : appointment.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (clearError) console.error('Error clearing reschedule request:', clearError);

      return new Response(JSON.stringify({ 
        success: true, 
        appointment: newAppointment, 
        action: 'duplicated',
        originalCancelled: cancelOriginal 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error: any) {
    console.error('Approve reschedule error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
