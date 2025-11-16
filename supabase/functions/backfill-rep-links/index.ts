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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check for active impersonation
    let effectiveUserId = user.id;
    const { data: impersonationData } = await supabaseAdmin
      .from('impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (impersonationData?.impersonated_user_id) {
      effectiveUserId = impersonationData.impersonated_user_id;
      console.log(`Using impersonated user ${effectiveUserId} for rep links`);
    }

    console.log(`Backfilling linked_topline_id for user ${effectiveUserId}`);

    // Get approved practices that need linking
    const { data: approvedPractices, error: practicesErr } = await supabaseAdmin
      .from('profiles')
      .select('id, linked_topline_id')
      .eq('role', 'doctor')
      .eq('active', true)
      .is('linked_topline_id', null);

    if (practicesErr) {
      console.error('Failed to fetch practices:', practicesErr);
      return new Response(
        JSON.stringify({ success: false, error: practicesErr.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Found ${approvedPractices?.length || 0} practices without linked_topline_id`);

    // Determine if user is topline or downline
    const { data: repData, error: repError } = await supabaseAdmin
      .from('reps')
      .select('id, role, assigned_topline_id')
      .eq('user_id', effectiveUserId)
      .single();

    if (repError || !repData) {
      return new Response(
        JSON.stringify({ error: 'User is not a rep' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const repIds: string[] = [];
    const userIds: string[] = [];

    if (repData.role === 'topline') {
      // For topline: include self + all active downlines
      repIds.push(repData.id);
      userIds.push(effectiveUserId);

      // Get all active downlines
      const { data: downlines, error: downlinesError } = await supabaseAdmin
        .from('reps')
        .select('id, user_id')
        .eq('assigned_topline_id', repData.id)
        .eq('role', 'downline')
        .eq('active', true);

      if (!downlinesError && downlines) {
        repIds.push(...downlines.map(d => d.id));
        userIds.push(...downlines.map(d => d.user_id));
      }
    } else if (repData.role === 'downline') {
      // For downline: only self
      repIds.push(repData.id);
      userIds.push(effectiveUserId);
    }

    console.log(`Processing ${repIds.length} rep(s) and ${userIds.length} user ID(s)`);

    // Find all active doctor practices linked to these user_ids (exclude rep profiles)
    const { data: practices, error: practicesErr2 } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        linked_topline_id,
        user_roles!inner(role)
      `)
      .in('linked_topline_id', userIds)
      .eq('active', true)
      .eq('user_roles.role', 'doctor');

    if (practicesErr2) {
      throw practicesErr2;
    }

    console.log(`Found ${practices?.length || 0} practices to link`);

    let linksAdded = 0;

    if (practices && practices.length > 0) {
      for (const practice of practices) {
        // Determine which rep_id to use
        let targetRepId: string | null = null;

        // Check if practice.linked_topline_id matches a downline user_id
        const downlineIndex = userIds.indexOf(practice.linked_topline_id);
        if (downlineIndex >= 0 && repIds[downlineIndex]) {
          targetRepId = repIds[downlineIndex];
        } else if (practice.linked_topline_id === effectiveUserId) {
          // Matches the topline user directly
          targetRepId = repData.id;
        }

        if (targetRepId) {
          // Update practice to link via linked_topline_id
          const { data: targetRep } = await supabaseAdmin
            .from('reps')
            .select('user_id')
            .eq('id', targetRepId)
            .single();

          if (targetRep) {
            const { error: linkError } = await supabaseAdmin
              .from('profiles')
              .update({
                linked_topline_id: targetRep.user_id,
                updated_at: new Date().toISOString()
              })
              .eq('id', practice.id);

            if (!linkError) {
              linksAdded++;
              console.log(`Linked practice ${practice.id} to rep user ${targetRep.user_id} via linked_topline_id`);
          } else {
            console.error(`Failed to link rep ${targetRepId} to practice ${practice.id}:`, linkError);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        linksAdded,
        message: `Successfully added ${linksAdded} practice link(s)`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in backfill-rep-links:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
