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
      console.error('[list-staff] No authorization header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[list-staff] Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[list-staff] User:', user.id);

    // Get user's role and practice
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = userRoles?.map(r => r.role) || [];
    console.log('[list-staff] User roles:', roles);

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
      // Staff: look up their practice_id to see other staff in same practice
      const { data: staffData } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', user.id)
        .single();
      practiceId = staffData?.practice_id || null;
      practiceIdSource = 'computed-staff';
    } else {
      console.error('[list-staff] No valid role for user (providers cannot view staff list)');
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[list-staff] practiceId:', practiceId, 'source:', practiceIdSource);

    if (!practiceId && !roles.includes('admin')) {
      console.error('[list-staff] No practice_id found for user');
      return new Response(JSON.stringify({ staff: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch staff with practice info - two-step query because no FK from practice_staff.user_id to profiles.id
    let staffQuery = supabase
      .from('practice_staff')
      .select(`
        id,
        user_id,
        practice_id,
        role_type,
        can_order,
        active,
        created_at,
        practice:profiles!practice_staff_practice_id_fkey(
          id,
          name,
          company
        )
      `)
      .order('created_at', { ascending: false });

    if (practiceId) {
      staffQuery = staffQuery.eq('practice_id', practiceId);
    }

    const { data: staffRows, error: staffError } = await staffQuery;

    if (staffError) {
      console.error('[list-staff] Query error:', staffError);
      return new Response(JSON.stringify({ error: staffError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!staffRows || staffRows.length === 0) {
      console.log('[list-staff] No staff found for practice', practiceId);
      
      // Defensive logging: Check for orphaned staff users
      const { data: orphanedStaff } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'staff');
      
      if (orphanedStaff && orphanedStaff.length > 0) {
        console.warn(`⚠️ Found ${orphanedStaff.length} staff users in user_roles without practice_staff records!`);
      }
      
      return new Response(JSON.stringify({ staff: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 2: Fetch user profiles for all staff members
    const userIds = staffRows.map(s => s.user_id);
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, full_name, email, phone, address')
      .in('id', userIds);

    if (profilesError) {
      console.error('[list-staff] Profiles query error:', profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Merge profiles onto staff rows
    const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const staff = staffRows.map(s => ({
      ...s,
      profiles: profilesMap.get(s.user_id) || null,
    }));

    console.log('[list-staff] Found', staff.length, 'staff members for practice', practiceId);
    if (staff.length > 0) {
      console.log('[list-staff] First staff profile:', staff[0].profiles?.name || staff[0].profiles?.email || 'no-name');
    }

    return new Response(JSON.stringify({ staff }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[list-staff] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
