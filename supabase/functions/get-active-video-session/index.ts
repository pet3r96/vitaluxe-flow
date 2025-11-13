import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    // Create admin client for database queries
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Decode user ID from JWT (already verified by platform)
    let decodedUserId: string | null = null;
    try {
      const payload = JSON.parse(
        atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
      );
      decodedUserId = payload.sub;
    } catch (e) {
      console.error('[get-active-video-session] Failed to decode JWT:', e);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[get-active-video-session] Auth decoded user:', decodedUserId);

    const userId = decodedUserId!;
    console.log('[get-active-video-session] Looking for session for user:', userId);

    // Check for impersonation
    const { data: impersonationData } = await supabaseAdmin
      .from('impersonation_sessions')
      .select('target_user_id')
      .eq('impersonator_user_id', userId)
      .eq('active', true)
      .single();

    const effectiveUserId = impersonationData?.target_user_id || userId;
    console.log('[get-active-video-session] Effective user ID:', effectiveUserId);

    // Get user's profile to determine their practice
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', effectiveUserId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is a provider
    const { data: providerData } = await supabaseAdmin
      .from('practice_providers')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .eq('active', true)
      .maybeSingle();

    // Check if user is a patient
    const { data: patientData } = await supabaseAdmin
      .from('patient_accounts')
      .select('id, practice_id')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    console.log('[get-active-video-session] Provider:', !!providerData, 'Patient:', !!patientData);

    // Build query for active sessions
    let sessionQuery = supabaseAdmin
      .from('video_sessions')
      .select('*')
      .in('status', ['live', 'scheduled', 'waiting', 'active', 'created'])
      .order('created_at', { ascending: false });

    // Filter based on role
    if (providerData) {
      // Provider: find sessions where they are the provider OR in their practice
      sessionQuery = sessionQuery.or(`provider_id.eq.${providerData.id},practice_id.eq.${providerData.practice_id}`);
    } else if (patientData) {
      // Patient: find sessions where they are the patient
      sessionQuery = sessionQuery.eq('patient_id', patientData.id);
    } else {
      // No provider or patient record - check if they're practice staff
      const { data: staffData } = await supabaseAdmin
        .from('practice_staff')
        .select('practice_id')
        .eq('user_id', effectiveUserId)
        .eq('active', true)
        .maybeSingle();

      if (staffData) {
        sessionQuery = sessionQuery.eq('practice_id', staffData.practice_id);
      } else {
        // No authorized role
        return new Response(
          JSON.stringify({ session: null, message: 'No active video session found' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Execute query
    const { data: sessions, error: sessionError } = await sessionQuery;

    if (sessionError) {
      console.error('[get-active-video-session] Session query error:', sessionError);
      throw sessionError;
    }

    if (!sessions || sessions.length === 0) {
      console.log('[get-active-video-session] No sessions found');
      return new Response(
        JSON.stringify({ session: null, message: 'No active video session found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the most recent session
    const session = sessions[0];
    console.log('[get-active-video-session] Found session:', session.id);

    // Determine user role in this session
    let role = 'guest';
    if (providerData && session.provider_id === providerData.id) {
      role = 'provider';
    } else if (patientData && session.patient_id === patientData.id) {
      role = 'patient';
    } else if (providerData || (await supabaseAdmin.from('practice_staff').select('id').eq('user_id', effectiveUserId).eq('practice_id', session.practice_id).maybeSingle()).data) {
      role = 'staff';
    }

    return new Response(
      JSON.stringify({
        session: {
          id: session.id,
          channelName: session.channel_name,
          practiceId: session.practice_id,
          providerId: session.provider_id,
          patientId: session.patient_id,
          status: session.status,
          scheduledStart: session.scheduled_start,
        },
        role,
        userId: effectiveUserId,
        isProvider: role === 'provider' || role === 'staff',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[get-active-video-session] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
