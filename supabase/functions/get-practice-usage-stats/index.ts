import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { practiceId, startDate, endDate } = await req.json();

    if (!practiceId) {
      throw new Error('Practice ID is required');
    }

    // Verify user has permission to view this practice's usage
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    
    const isAdmin = userRoles?.some(r => r.role === 'admin');
    const isPracticeOwner = practiceId === user.id;

    if (!isAdmin && !isPracticeOwner) {
      // Check if user is practice staff
      const { data: staffMember } = await supabaseClient
        .from('practice_staff')
        .select('id')
        .eq('user_id', user.id)
        .eq('practice_id', practiceId)
        .eq('active', true)
        .maybeSingle();

      if (!staffMember) {
        throw new Error('Not authorized to view this practice usage');
      }
    }

    // Build query for usage logs
    let query = supabaseClient
      .from('usage_logs')
      .select(`
        *,
        providers!usage_logs_provider_id_fkey(id, user_id),
        patient_accounts!usage_logs_patient_id_fkey(id, first_name, last_name)
      `)
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false });

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('start_time', startDate);
    }
    if (endDate) {
      query = query.lte('end_time', endDate);
    }

    const { data: usageLogs, error: usageError } = await query;

    if (usageError) throw usageError;

    // Calculate aggregate stats
    const totalMinutes = usageLogs?.reduce((sum, log) => sum + log.duration_minutes, 0) || 0;
    const totalSessions = usageLogs?.length || 0;

    // Group by provider
    const providerStats = usageLogs?.reduce((acc: any, log) => {
      const providerId = log.provider_id || 'unknown';
      if (!acc[providerId]) {
        acc[providerId] = {
          provider_id: providerId,
          total_minutes: 0,
          session_count: 0
        };
      }
      acc[providerId].total_minutes += log.duration_minutes;
      acc[providerId].session_count += 1;
      return acc;
    }, {});

    // Get provider names
    if (providerStats && Object.keys(providerStats).length > 0) {
      for (const providerId of Object.keys(providerStats)) {
        if (providerId === 'unknown') continue;
        
        const { data: provider } = await supabaseClient
          .from('providers')
          .select('user_id')
          .eq('id', providerId)
          .maybeSingle();

        if (provider?.user_id) {
          const { data: profile } = await supabaseClient
            .from('profiles')
            .select('full_name, name')
            .eq('id', provider.user_id)
            .maybeSingle();

          providerStats[providerId].provider_name = profile?.full_name || profile?.name || 'Unknown Provider';
        }
      }
    }

    return new Response(
      JSON.stringify({
        totalMinutes,
        totalSessions,
        providerStats: Object.values(providerStats || {}),
        usageLogs: usageLogs || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Get practice usage stats error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
