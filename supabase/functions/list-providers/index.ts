import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[list-providers] No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[list-providers] Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[list-providers] User:', user.id);

    // Get user's role and practice
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    console.log('[list-providers] User roles:', roles);

    let practiceId: string | null = null;
    let practiceIdSource = 'none';

    // Accept practice_id from body (for impersonation) or query string
    const url = new URL(req.url);
    const queryPracticeId = url.searchParams.get('practice_id');
    let bodyPracticeId: string | null = null;
    
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        bodyPracticeId = body.practice_id || null;
      } catch (e) {
        // No body or invalid JSON, that's OK
      }
    }

    if (roles.includes('admin')) {
      // Admins: prefer body practice_id (impersonation), then query param
      practiceId = bodyPracticeId || queryPracticeId;
      practiceIdSource = bodyPracticeId ? 'body' : queryPracticeId ? 'query' : 'none';
    } else if (roles.includes('doctor')) {
      // Doctor: their user_id IS the practice_id
      practiceId = user.id;
      practiceIdSource = 'computed-doctor';
    } else if (roles.includes('staff')) {
      // Staff: look up their practice_id
      const { data: staffData } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', user.id)
        .single();
      
      console.log('[list-providers] Staff lookup:', {
        userId: user.id,
        staffData,
        practiceId: staffData?.practice_id
      });
      
      if (!staffData || !staffData.practice_id) {
        console.warn('[list-providers] ⚠️ Staff has no active practice_staff record');
        return new Response(
          JSON.stringify({ providers: [], error: 'Staff membership not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      
      practiceId = staffData.practice_id;
      practiceIdSource = 'computed-staff';
    } else if (roles.includes('provider')) {
      // Provider: can only see themselves
      const { data: providerData } = await supabase
        .from('providers')
        .select(`
          id,
          user_id,
          practice_id,
          role_type,
          can_order,
          active,
          created_at,
          profiles!providers_user_id_fkey!inner(
            id,
            name,
            full_name,
            prescriber_name,
            email,
            phone,
            address,
            npi,
            dea,
            license_number
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (providerData) {
        console.log('[list-providers] Provider role: returning own record only');
        return new Response(JSON.stringify({ providers: [providerData] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        console.log('[list-providers] Provider not found for user:', user.id);
        return new Response(JSON.stringify({ providers: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      console.error('[list-providers] No valid role for user');
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[list-providers] practiceId:', practiceId, 'source:', practiceIdSource);

    if (!practiceId && !roles.includes('admin')) {
      console.error('[list-providers] No practice_id found for user');
      return new Response(JSON.stringify({ providers: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch providers only (role_type = 'provider')
    let providersQuery = supabase
      .from('providers')
      .select(`
        id,
        user_id,
        practice_id,
        role_type,
        can_order,
        active,
        created_at
      `)
      .eq('role_type', 'provider')
      .order('created_at', { ascending: false });

    if (practiceId) {
      providersQuery = providersQuery.eq('practice_id', practiceId);
    }

    const { data: providersRows, error: providersError } = await providersQuery;

    if (providersError) {
      console.error('[list-providers] Query error:', providersError);
      return new Response(JSON.stringify({ error: providersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!providersRows || providersRows.length === 0) {
      console.log('[list-providers] No providers found for practice', practiceId);
      return new Response(JSON.stringify({ providers: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch user profiles for all providers
    const userIds = providersRows.map(p => p.user_id);
    const practiceIds = [...new Set(providersRows.map(p => p.practice_id))];

    // Defensive logging: Verify caller's practice_staff membership for staff users
    if (roles.includes('staff') && practiceId) {
      const { data: staffMembership } = await supabase
        .from('practice_staff')
        .select('id, active')
        .eq('user_id', user.id)
        .eq('practice_id', practiceId)
        .maybeSingle();
      
      if (!staffMembership) {
        console.error(`❌ CRITICAL: Staff user ${user.id} has no practice_staff record for practice ${practiceId}!`);
      } else if (!staffMembership.active) {
        console.warn(`⚠️ Staff user ${user.id} has inactive practice_staff membership for practice ${practiceId}`);
      } else {
        console.log(`✅ Staff user ${user.id} has valid practice_staff membership`);
      }
    }

    const { data: userProfiles, error: userProfilesError } = await supabase
      .from('profiles')
      .select('id, name, full_name, prescriber_name, email, phone, address, npi, dea, license_number')
      .in('id', userIds);

    if (userProfilesError) {
      console.error('[list-providers] User profiles query error:', userProfilesError);
      return new Response(JSON.stringify({ error: userProfilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Fetch practice profiles
    const { data: practiceProfiles, error: practiceProfilesError } = await supabase
      .from('profiles')
      .select('id, name, company')
      .in('id', practiceIds);

    if (practiceProfilesError) {
      console.error('[list-providers] Practice profiles query error:', practiceProfilesError);
    }

    // Merge profiles onto provider rows
    const userProfilesMap = new Map(userProfiles?.map(p => [p.id, p]) || []);
    const practiceProfilesMap = new Map(practiceProfiles?.map(p => [p.id, p]) || []);
    
    const providers = providersRows.map(p => ({
      ...p,
      profiles: userProfilesMap.get(p.user_id) || null,
      practice: practiceProfilesMap.get(p.practice_id) || null,
    }));

    console.log('[list-providers] Found', providers.length, 'providers for practice', practiceId);
    if (providers.length > 0) {
      console.log('[list-providers] First provider profile:', providers[0].profiles?.name || providers[0].profiles?.email || 'no-name');
    }

    return new Response(JSON.stringify({ providers }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Function-Version': '2.0-unified'
      },
    });

  } catch (error) {
    console.error('[list-providers] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
