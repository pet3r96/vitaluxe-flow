// ============================================================================
// GET OR CREATE PRACTICE ROOM
// Returns permanent practice room link or creates one if it doesn't exist
// ============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[get-or-create-practice-room] Request received');

    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[get-or-create-practice-room] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for impersonation
    let effectiveUserId = user.id;
    const { data: impersonationSession } = await supabase
      .from('active_impersonation_sessions')
      .select('target_user_id')
      .eq('admin_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (impersonationSession) {
      effectiveUserId = impersonationSession.target_user_id;
      console.log('[get-or-create-practice-room] Impersonation detected:', {
        adminUserId: user.id,
        effectiveUserId
      });
    }

    // Get practice ID from request body
    const { practice_id } = await req.json();

    if (!practice_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: practice_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-or-create-practice-room] Practice ID:', practice_id);

    // Verify user has access to this practice
    const isPracticeOwner = effectiveUserId === practice_id;
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', practice_id)
      .maybeSingle();

    const { data: staff } = await supabase
      .from('practice_staff')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', practice_id)
      .maybeSingle();

    if (!isPracticeOwner && !provider && !staff) {
      console.error('[get-or-create-practice-room] Unauthorized');
      return new Response(
        JSON.stringify({ error: 'Not authorized for this practice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const practiceId = practice_id;

    // Check if practice room exists
    const { data: existingRoom, error: roomError } = await supabase
      .from('practice_video_rooms')
      .select('*')
      .eq('practice_id', practiceId)
      .single();

    if (existingRoom) {
      console.log('[get-or-create-practice-room] Room already exists:', existingRoom.room_key);
      return new Response(
        JSON.stringify({
          success: true,
          room: {
            id: existingRoom.id,
            roomKey: existingRoom.room_key,
            channelName: existingRoom.channel_name,
            activeSessionId: existingRoom.active_session_id,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new practice room
    console.log('[get-or-create-practice-room] Creating new room for practice:', practiceId);

    const channelName = `practice_${practiceId}`;
    
    // Generate room key using DB function
    const { data: roomKeyData, error: roomKeyError } = await supabase
      .rpc('generate_room_key');

    if (roomKeyError || !roomKeyData) {
      console.error('[get-or-create-practice-room] Failed to generate room key:', roomKeyError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate room key' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert new practice room
    const { data: newRoom, error: insertError } = await supabase
      .from('practice_video_rooms')
      .insert({
        practice_id: practiceId,
        channel_name: channelName,
        room_key: roomKeyData,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[get-or-create-practice-room] Failed to create room:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create practice room', details: insertError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-or-create-practice-room] New room created:', newRoom.room_key);

    return new Response(
      JSON.stringify({
        success: true,
        room: {
          id: newRoom.id,
          roomKey: newRoom.room_key,
          channelName: newRoom.channel_name,
          activeSessionId: null,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[get-or-create-practice-room] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
