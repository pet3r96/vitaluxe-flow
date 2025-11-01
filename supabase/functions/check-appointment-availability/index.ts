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

    const { providerId, roomId, startTime, endTime, appointmentId } = await req.json();

    if (!providerId || !startTime || !endTime) {
      throw new Error('Missing required fields: providerId, startTime, endTime');
    }

    // Check for provider conflicts
    const { data: providerConflicts, error: providerError } = await supabaseClient
      .from('patient_appointments')
      .select('id, start_time, end_time, patient_accounts(first_name, last_name)')
      .eq('provider_id', providerId)
      .neq('status', 'cancelled')
      .neq('status', 'no_show')
      .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`)
      .not('id', 'eq', appointmentId || '00000000-0000-0000-0000-000000000000');

    if (providerError) throw providerError;

    // Check for room conflicts if room is specified
    let roomConflicts: any[] = [];
    if (roomId) {
      const { data: roomData, error: roomError } = await supabaseClient
        .from('patient_appointments')
        .select('id, start_time, end_time, patient_accounts(first_name, last_name)')
        .eq('room_id', roomId)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .or(`and(start_time.lte.${endTime},end_time.gte.${startTime})`)
        .not('id', 'eq', appointmentId || '00000000-0000-0000-0000-000000000000');

      if (roomError) throw roomError;
      roomConflicts = roomData || [];
    }

    const hasConflict = (providerConflicts?.length || 0) > 0 || roomConflicts.length > 0;

    return new Response(
      JSON.stringify({
        available: !hasConflict,
        conflicts: {
          provider: providerConflicts || [],
          room: roomConflicts
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Availability check error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
