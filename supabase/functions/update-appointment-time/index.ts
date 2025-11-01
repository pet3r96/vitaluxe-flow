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

    const { appointmentId, startTime, endTime, providerId, roomId } = await req.json();

    if (!appointmentId || !startTime || !endTime) {
      throw new Error('Missing required fields: appointmentId, startTime, endTime');
    }

    // Get current appointment
    const { data: currentAppt, error: fetchError } = await supabaseClient
      .from('patient_appointments')
      .select('*, providers!inner(practice_id)')
      .eq('id', appointmentId)
      .single();

    if (fetchError) throw fetchError;
    if (!currentAppt) throw new Error('Appointment not found');

    // Check for conflicts (excluding this appointment)
    const checkProviderId = providerId || currentAppt.provider_id;
    const checkRoomId = roomId || currentAppt.room_id;

    const { data: conflicts, error: conflictError } = await supabaseClient
      .from('patient_appointments')
      .select('id')
      .eq('provider_id', checkProviderId)
      .neq('id', appointmentId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

    if (conflictError) throw conflictError;

    if (conflicts && conflicts.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Time slot conflict detected',
          hasConflict: true 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check room conflicts if room is specified
    if (checkRoomId) {
      const { data: roomConflicts, error: roomError } = await supabaseClient
        .from('patient_appointments')
        .select('id')
        .eq('room_id', checkRoomId)
        .neq('id', appointmentId)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

      if (roomError) throw roomError;

      if (roomConflicts && roomConflicts.length > 0) {
        return new Response(
          JSON.stringify({ 
            error: 'Room conflict detected',
            hasConflict: true 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Update appointment
    const updateData: any = {
      start_time: startTime,
      end_time: endTime,
      updated_at: new Date().toISOString()
    };

    if (providerId) updateData.provider_id = providerId;
    if (roomId) updateData.room_id = roomId;

    const { data: updated, error: updateError } = await supabaseClient
      .from('patient_appointments')
      .update(updateData)
      .eq('id', appointmentId)
      .select()
      .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        appointment: updated 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Update appointment time error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
