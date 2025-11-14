// ============================================================================
// CREATE VIDEO SESSION
// Creates instant or scheduled video consultation sessions
// ============================================================================

import { createAuthClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.4';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  practiceId: string;
  providerId?: string;
  patientId?: string;
  sessionType: 'instant' | 'scheduled' | 'practice_room';
  scheduledStart?: string; // ISO timestamp
  scheduledEnd?: string;   // ISO timestamp
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[create-video-session] Request received');

    // Get Supabase client
    const supabase = createAuthClient(req.headers.get('Authorization'));

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[create-video-session] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      console.error('[create-video-session] CSRF validation failed:', csrfError);
      return new Response(
        JSON.stringify({ error: csrfError || 'Invalid CSRF token' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for impersonation session
    let effectiveUserId = user.id;
    const { data: impersonationSession } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (impersonationSession) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      console.log('[create-video-session] Impersonation detected:', {
        adminUserId: user.id,
        effectiveUserId
      });
    }

    // Parse request body
    const body: CreateSessionRequest = await req.json();
    const { practiceId, providerId, patientId, sessionType, scheduledStart, scheduledEnd } = body;

    console.log('[create-video-session] Creating session:', {
      practiceId,
      providerId,
      patientId,
      sessionType,
      scheduledStart,
    });

    // Verify user has access to this practice
    // Check if effective user is the practice owner (doctor role)
    const isPracticeOwner = effectiveUserId === practiceId;
    
    // Check if effective user is a provider in this practice
    const { data: provider } = await supabase
      .from('providers')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', practiceId)
      .maybeSingle();

    // Check if effective user is staff in this practice (if staff table exists)
    const { data: staff } = await supabase
      .from('practice_staff')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('practice_id', practiceId)
      .maybeSingle();

    // Allow if user is practice owner, provider, or staff
    if (!isPracticeOwner && !provider && !staff) {
      console.error('[create-video-session] Authorization failed:', {
        effectiveUserId,
        practiceId,
        isPracticeOwner,
        hasProvider: !!provider,
        hasStaff: !!staff
      });
      return new Response(
        JSON.stringify({ error: 'Not authorized for this practice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-video-session] Authorization successful:', {
      effectiveUserId,
      isPracticeOwner,
      isProvider: !!provider,
      isStaff: !!staff
    });

    // Generate unique channel name
    const channelName = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Determine initial status
    const status = sessionType === 'scheduled' && scheduledStart ? 'scheduled' : 'live';

    // Determine the effective provider ID
    const effectiveProviderId = providerId || (provider ? provider.id : null);

    // Create video session
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .insert({
        practice_id: practiceId,
        provider_id: effectiveProviderId,
        patient_id: patientId,
        channel_name: channelName,
        session_type: sessionType,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        status,
        actual_start: status === 'live' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[create-video-session] Session creation failed:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[create-video-session] Session created:', session.id);

    // Generate Agora tokens
    const appId = Deno.env.get('VITE_AGORA_APP_ID')!;
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE') || '';
    const uid = Math.floor(Math.random() * 1000000);
    const ttl = 3600; // 1 hour

    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      Role.PUBLISHER,
      ttl,
      ttl
    );
      RtcRole.PUBLISHER,
      Math.floor(Date.now() / 1000) + ttl
    );

    const rtmUid = `${uid}`;
    const rtmToken = rtcToken; // Using same token for RTM

    console.log('[create-video-session] Tokens generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        session: {
          id: session.id,
          channelName,
          status,
          sessionType,
        },
        credentials: {
          rtcToken,
          rtmToken,
          uid: uid.toString(),
          rtmUid,
          appId,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[create-video-session] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
