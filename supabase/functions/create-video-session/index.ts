// ============================================================================
// CREATE VIDEO SESSION
// Creates instant or scheduled video consultation sessions
// ============================================================================

import { createAuthClient, createAdminClient } from '../_shared/supabaseAdmin.ts';
import { successResponse, errorResponse } from '../_shared/responses.ts';
import { RtcTokenBuilder, RtcRole } from 'https://esm.sh/agora-token@2.0.4';
import { validateCSRFToken } from '../_shared/csrfValidator.ts';
import { edgeLogger } from '../_shared/logger.ts';

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

  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    edgeLogger.info('Create video session request received');

    // Get Supabase client
    const supabase = createAuthClient(req.headers.get('Authorization'));
    const supabaseAdmin = createAdminClient();

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      edgeLogger.error('Auth error', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate CSRF token
    const csrfToken = req.headers.get('x-csrf-token') || undefined;
    const { valid, error: csrfError } = await validateCSRFToken(supabase, user.id, csrfToken);
    if (!valid) {
      edgeLogger.error('CSRF validation failed', undefined, { error: csrfError });
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
      edgeLogger.info('Impersonation detected', { adminUserId: user.id, effectiveUserId });
    }

    // Parse request body
    const body: CreateSessionRequest = await req.json();
    const { practiceId, providerId, patientId, sessionType, scheduledStart, scheduledEnd } = body;

    edgeLogger.info('Creating video session', { practiceId, sessionType });

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
      edgeLogger.error('Authorization failed', undefined, { effectiveUserId, practiceId });
      return new Response(
        JSON.stringify({ error: 'Not authorized for this practice' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Authorization successful', { effectiveUserId, isPracticeOwner });

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
      edgeLogger.error('Session creation failed', sessionError);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    edgeLogger.info('Video session created', { sessionId: session.id });

    // Generate Agora tokens
    const appId = Deno.env.get('VITE_AGORA_APP_ID')!;
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE') || '';
    const uid = Math.floor(Math.random() * 1000000);
    const ttl = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpire = currentTimestamp + ttl;

    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      ttl,
      privilegeExpire
    );

    const rtmUid = `${uid}`;
    const rtmToken = rtcToken; // Using same token for RTM

    edgeLogger.info('Tokens generated successfully');

    // PHASE 2: Audit logging for video_session_created
    await supabaseAdmin.from('audit_logs').insert({
      action_type: 'video_session_created',
      user_id: user.id,
      entity_type: 'video_sessions',
      entity_id: session.id,
      ip_address: ipAddress,
      details: {
        channel_name: channelName,
        session_type: sessionType,
        practice_id: practiceId,
        provider_id: providerId,
        patient_id: patientId,
        timestamp: new Date().toISOString()
      }
    });

    // PHASE 2: Structured logging
    edgeLogger.logOperation({
      user_id: user.id,
      ip_address: ipAddress,
      operation: 'create_video_session',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: { sessionId: session.id, channelName, sessionType }
    });

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
    edgeLogger.error('Unexpected error in create-video-session', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    edgeLogger.logOperation({
      user_id: undefined,
      ip_address: ipAddress,
      operation: 'create_video_session',
      success: false,
      duration_ms: Date.now() - startTime,
      metadata: { error: errorMessage }
    });
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
