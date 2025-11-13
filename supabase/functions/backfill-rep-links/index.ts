import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const supabaseAdmin = createAdminClient();

    // Get current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`Backfilling rep_practice_links for user ${user.id}`);

    // Determine if user is topline or downline
    const { data: repData, error: repError } = await supabaseAdmin
      .from('reps')
      .select('id, role, assigned_topline_id')
      .eq('user_id', user.id)
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
      userIds.push(user.id);

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
      userIds.push(user.id);
    }

    console.log(`Processing ${repIds.length} rep(s) and ${userIds.length} user ID(s)`);

    // Find all active doctor practices linked to these user_ids (exclude rep profiles)
    const { data: practices, error: practicesError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        linked_topline_id,
        user_roles!inner(role)
      `)
      .in('linked_topline_id', userIds)
      .eq('active', true)
      .eq('user_roles.role', 'doctor');

    if (practicesError) {
      throw practicesError;
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
        } else if (practice.linked_topline_id === user.id) {
          // Matches the topline user directly
          targetRepId = repData.id;
        }

        if (targetRepId) {
          // Determine assigned_topline_id for the link
          let toplineIdForLink = null;
          
          // Get the rep's details to check if it's a downline
          const { data: targetRepDetails } = await supabaseAdmin
            .from('reps')
            .select('role, assigned_topline_id')
            .eq('id', targetRepId)
            .single();
          
          if (targetRepDetails?.role === 'downline' && targetRepDetails.assigned_topline_id) {
            toplineIdForLink = targetRepDetails.assigned_topline_id;
          }
          
          // Upsert the link with assigned_topline_id
          const { error: linkError } = await supabaseAdmin
            .from('rep_practice_links')
            .upsert(
              {
                rep_id: targetRepId,
                practice_id: practice.id,
                assigned_topline_id: toplineIdForLink,
                created_at: new Date().toISOString(),
              },
              { onConflict: 'rep_id,practice_id' }
            );

          if (!linkError) {
            linksAdded++;
            console.log(`Linked rep ${targetRepId} to practice ${practice.id}`);
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
