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

    if (roles.includes('admin')) {
      // Admins can optionally filter by practice_id from query params
      const url = new URL(req.url);
      practiceId = url.searchParams.get('practice_id');
    } else if (roles.includes('doctor')) {
      // Doctor: their user_id IS the practice_id
      practiceId = user.id;
    } else if (roles.includes('staff')) {
      // Staff: look up their practice_id to see other staff in same practice
      const { data: staffData } = await supabase
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', user.id)
        .single();
      practiceId = staffData?.practice_id || null;
    } else {
      console.error('[list-staff] No valid role for user (providers cannot view staff list)');
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!practiceId && !roles.includes('admin')) {
      console.error('[list-staff] No practice_id found for user');
      return new Response(JSON.stringify({ staff: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch staff with full profile data using service role
    let query = supabase
      .from('practice_staff')
      .select(`
        id,
        user_id,
        practice_id,
        role_type,
        can_order,
        active,
        created_at,
        profiles!practice_staff_user_id_fkey!inner(
          id,
          name,
          email,
          phone,
          address
        )
      `)
      .order('created_at', { ascending: false });

    if (practiceId) {
      query = query.eq('practice_id', practiceId);
    }

    const { data: staff, error: staffError } = await query;

    if (staffError) {
      console.error('[list-staff] Query error:', staffError);
      return new Response(JSON.stringify({ error: staffError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[list-staff] Found', staff?.length || 0, 'staff members for practice', practiceId);

    return new Response(JSON.stringify({ staff: staff || [] }), {
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
