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

    // Get all providers for the practice with proper profile data
    const { data: allProviders } = await supabaseClient
      .from('providers')
      .select(`
        id, 
        user_id, 
        active,
        profiles!inner(id, name, full_name)
      `)
      .eq('practice_id', practiceId)
      .eq('active', true);

    // Transform to use actual profile names
    const transformedProviders = (allProviders || []).map((p: any) => {
      // Use full_name if available, otherwise use name
      const displayName = p.profiles?.full_name || p.profiles?.name || 'Unknown Provider';
      const nameParts = displayName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      return {
        id: p.id,
        user_id: p.user_id,
        active: p.active,
        first_name: firstName,
        last_name: lastName,
        full_name: displayName,
        specialty: null
      };
    });

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
        providers: transformedProviders || [],
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
