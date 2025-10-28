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

    const { practiceId, startDate, endDate, providers, rooms, statuses } = await req.json();

    if (!practiceId || !startDate || !endDate) {
      throw new Error('Missing required fields: practiceId, startDate, endDate');
    }

    // Build query
    let query = supabaseClient
      .from('patient_appointments')
      .select(`
        *,
        patient_accounts!inner(id, first_name, last_name, phone, email),
        providers!inner(id, user_id, profiles!inner(name)),
        practice_rooms(id, name, color)
      `)
      .eq('practice_id', practiceId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    // Apply filters
    if (providers && providers.length > 0) {
      query = query.in('provider_id', providers);
    }

    if (rooms && rooms.length > 0) {
      query = query.in('room_id', rooms);
    }

    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses);
    } else {
      // Default: exclude cancelled and no-show
      query = query.not('status', 'in', '(cancelled,no_show)');
    }

    const { data: appointments, error: appointmentsError } = await query;

    if (appointmentsError) throw appointmentsError;

    // Get practice settings
    const { data: settings } = await supabaseClient
      .from('appointment_settings')
      .select('*')
      .eq('practice_id', practiceId)
      .maybeSingle();

    // Get all providers for the practice
    const { data: allProviders } = await supabaseClient
      .from('providers')
      .select('id, user_id, active, profiles!inner(name)')
      .eq('practice_id', practiceId)
      .eq('active', true);

    // Get all rooms for the practice
    const { data: allRooms } = await supabaseClient
      .from('practice_rooms')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('active', true)
      .order('name');

    return new Response(
      JSON.stringify({
        appointments: appointments || [],
        settings: settings || {
          slot_duration: 15,
          start_hour: 7,
          end_hour: 20,
          working_days: [1, 2, 3, 4, 5]
        },
        providers: allProviders || [],
        rooms: allRooms || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Get calendar data error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
