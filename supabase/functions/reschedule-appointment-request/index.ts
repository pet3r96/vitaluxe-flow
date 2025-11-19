import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';
import { validateUserOwnsResource } from '../_shared/idValidator.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { appointmentId, newDate, newTime, reason, clientDateTimeIso, timezoneOffsetMinutes } = await req.json();
    
    // PHASE 3: ID validation - verify appointment belongs to user's patient account
    const { data: appointment } = await supabaseAdmin
      .from('patient_appointments')
      .select('patient_accounts!inner(user_id)')
      .eq('id', appointmentId)
      .single();
    
    const patientAccount = Array.isArray(appointment?.patient_accounts) 
      ? appointment.patient_accounts[0] 
      : appointment?.patient_accounts;
    
    if (!appointment || !patientAccount || patientAccount.user_id !== user.id) {
      edgeLogger.error('ID validation failed', undefined, { userId: user.id, appointmentId });
      throw new Error('Appointment not found or access denied');
    }
    
    edgeLogger.info('Reschedule request received', { 
      appointmentId, 
      newDate, 
      newTime, 
      clientDateTimeIso, 
      timezoneOffsetMinutes 
    });

    // Fetch appointment details for update
    const { data: appointmentData, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('id')
      .eq('id', appointmentId)
      .single();

    if (fetchError || !appointmentData) {
      throw new Error('Appointment not found');
    }

    // Update appointment with reschedule request
    const { data, error } = await supabaseClient
      .from('patient_appointments')
      .update({
        requested_date: newDate,
        requested_time: newTime,
        reschedule_requested_at: new Date().toISOString(),
        reschedule_reason: reason,
        confirmation_type: 'pending',
        status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', appointmentId)
      .select()
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, appointment: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
