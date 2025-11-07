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

    const { practiceId, startDate, endDate, providers, rooms, statuses, effectiveProviderUserId } = await req.json();

    if (!practiceId || !startDate || !endDate) {
      throw new Error('Missing required fields: practiceId, startDate, endDate');
    }

    // Detect caller role
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const callerRole = userRoles?.[0]?.role || null;
    console.log('Caller role:', callerRole, 'User ID:', user.id);

    // Determine provider scoping
    let providerRecord = null;
    let isProviderScoped = false;

    if (callerRole === 'provider') {
      // Provider accounts: scope to their own provider record
      const { data } = await supabaseClient
        .from('providers')
        .select('id, practice_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      providerRecord = data;
      isProviderScoped = !!providerRecord;
      console.log('Provider scope (by role):', isProviderScoped, 'Provider ID:', providerRecord?.id);
    } else if (callerRole === 'admin' && effectiveProviderUserId) {
      // Admin impersonating provider: scope to the effective provider
      const { data } = await supabaseClient
        .from('providers')
        .select('id, practice_id')
        .eq('user_id', effectiveProviderUserId)
        .maybeSingle();
      
      if (!data) {
        throw new Error('Provider not found for effective user');
      }
      
      if (data.practice_id !== practiceId) {
        throw new Error('Provider does not belong to the specified practice');
      }
      
      providerRecord = data;
      isProviderScoped = true;
      console.log('Provider scope (admin impersonation):', isProviderScoped, 'Effective Provider ID:', providerRecord?.id);
    }

    // Build query - use left join for providers so pending appointments without providers show up
    let query = supabaseClient
      .from('patient_appointments')
      .select(`
        *,
        patient_accounts!inner(id, first_name, last_name, phone, email),
        providers!patient_appointments_provider_id_fkey(id, user_id, profiles!providers_user_id_fkey(name, full_name)),
        practice_rooms(id, name, color),
        checked_in_at,
        treatment_started_at
      `)
      .eq('practice_id', practiceId)
      .gte('start_time', startDate)
      .lte('start_time', endDate)
      .order('start_time', { ascending: true });

    // If provider-scoped, filter to only their appointments
    if (isProviderScoped && providerRecord) {
      query = query.eq('provider_id', providerRecord.id);
      console.log('Filtering appointments to provider:', providerRecord.id);
    }

    // Apply filters (ignore provider filters if provider-scoped)
    if (!isProviderScoped && providers && providers.length > 0) {
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

    // Parallel fetch for better performance
    const [settingsResult, providersData, roomsResult, blockedTimeResult] = await Promise.all([
      // Get practice settings
      supabaseClient
        .from('appointment_settings')
        .select('*')
        .eq('practice_id', practiceId)
        .maybeSingle(),
      
      // Get providers based on user type
      (async () => {
        if (isProviderScoped && providerRecord) {
          const effectiveUserId = effectiveProviderUserId || user.id;
          const { data: providerProfile } = await supabaseClient
            .from('profiles')
            .select('id, name, full_name')
            .eq('id', effectiveUserId)
            .maybeSingle();

          if (providerProfile) {
            const displayName = providerProfile.full_name || providerProfile.name || 'Provider';
            const nameParts = displayName.trim().split(' ');
            return [{
              id: providerRecord.id,
              user_id: effectiveUserId,
              active: true,
              first_name: nameParts[0] || 'Provider',
              last_name: nameParts.slice(1).join(' ') || '',
              full_name: displayName,
              specialty: null
            }];
          }
          return [];
        } else {
          // Fetch providers with their profiles - use left join to ensure providers show even without profile
          const { data: providerRecords, error: providerError } = await supabaseClient
            .from('providers')
            .select(`
              id,
              user_id,
              active,
              profiles:user_id(id, name, full_name)
            `)
            .eq('practice_id', practiceId)
            .eq('active', true);
          
          if (providerError) {
            console.error('[get-calendar-data] Error fetching providers:', providerError);
            return [];
          }
          
          if (providerRecords && providerRecords.length > 0) {
            console.log('[get-calendar-data] Raw provider records:', JSON.stringify(providerRecords, null, 2));
            
            return providerRecords.map((p: any) => {
              const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
              
              console.log('[get-calendar-data] Processing provider:', {
                provider_id: p.id,
                user_id: p.user_id,
                profile_exists: !!profile,
                profile_name: profile?.name,
                profile_full_name: profile?.full_name
              });
              
              // Build display name with better fallbacks
              let displayName = 'Provider';
              if (profile?.full_name) {
                displayName = profile.full_name;
              } else if (profile?.name) {
                displayName = profile.name;
              }
              
              const nameParts = displayName.trim().split(' ');
              const result = {
                id: p.id,
                user_id: p.user_id,
                active: p.active,
                first_name: nameParts[0] || 'Provider',
                last_name: nameParts.slice(1).join(' ') || '',
                full_name: displayName,
                specialty: null
              };
              
              console.log('[get-calendar-data] Transformed provider:', result);
              return result;
            });
          }
          return [];
        }
      })(),

      // Get all rooms for the practice
      supabaseClient
        .from('practice_rooms')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('active', true)
        .order('name'),

      // Fetch blocked time for the date range
      supabaseClient
        .from('practice_blocked_time')
        .select('*')
        .eq('practice_id', practiceId)
        .or(`start_time.lte.${endDate},end_time.gte.${startDate}`)
    ]);

    const settings = settingsResult.data;
    const transformedProviders = providersData;
    const allRooms = roomsResult.data;
    const blockedTime = blockedTimeResult.data;

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
        rooms: allRooms || [],
        blockedTime: blockedTime || []
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
