import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabaseClient, user.id, csrfToken);
    if (!valid) {
      console.error('CSRF validation failed:', csrfError);
      return errorResponse(csrfError || 'Invalid CSRF token', 403);
    }

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

    return successResponse({ appointment: updated });
  } catch (error: any) {
    console.error('Update appointment time error:', error);
    return errorResponse(error.message, 400);
  }
});
