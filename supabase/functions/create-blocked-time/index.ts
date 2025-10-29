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

    const { practiceId, blockType, providerId, startTime, endTime, reason, notes } = await req.json();

    // Validation
    if (!practiceId || !blockType || !startTime || !endTime) {
      throw new Error('Missing required fields');
    }

    if (blockType === 'provider_unavailable' && !providerId) {
      throw new Error('Provider ID required for provider unavailable blocks');
    }

    // Check permissions
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const userRoles = roles?.map(r => r.role) || [];
    const isAdmin = userRoles.includes('admin');
    const isPracticeOwner = user.id === practiceId;
    
    // Check if user is staff for this practice
    const { data: staffRecord } = await supabaseClient
      .from('practice_staff')
      .select('id')
      .eq('user_id', user.id)
      .eq('practice_id', practiceId)
      .eq('active', true)
      .maybeSingle();
    
    const isStaff = !!staffRecord;

    // Check if user is the provider
    const { data: providerRecord } = providerId ? await supabaseClient
      .from('providers')
      .select('id')
      .eq('id', providerId)
      .eq('user_id', user.id)
      .maybeSingle() : { data: null };
    
    const isOwnProvider = !!providerRecord;

    // Permission check
    if (!isAdmin && !isPracticeOwner && !isStaff && !isOwnProvider) {
      throw new Error('Insufficient permissions to block time');
    }

    // Providers can only block their own time
    if (isOwnProvider && !isPracticeOwner && !isStaff && !isAdmin) {
      if (blockType === 'practice_closure') {
        throw new Error('Providers cannot block the entire practice');
      }
    }

    // Check for conflicting appointments
    const { data: conflicts, error: conflictError } = await supabaseClient
      .rpc('get_appointments_during_blocked_time', {
        p_practice_id: practiceId,
        p_provider_id: blockType === 'provider_unavailable' ? providerId : null,
        p_start_time: startTime,
        p_end_time: endTime
      });

    if (conflictError) {
      console.error('Error checking conflicts:', conflictError);
    }

    // Create blocked time
    const { data: blockedTime, error: insertError } = await supabaseClient
      .from('practice_blocked_time')
      .insert({
        practice_id: practiceId,
        blocked_by: user.id,
        block_type: blockType,
        provider_id: blockType === 'provider_unavailable' ? providerId : null,
        start_time: startTime,
        end_time: endTime,
        reason,
        notes
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        blockedTime,
        conflictingAppointments: conflicts || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error creating blocked time:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
