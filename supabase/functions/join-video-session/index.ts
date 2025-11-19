import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { edgeLogger } from '../_shared/logger.ts';

const agoraAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

Deno.serve(async (req) => {
  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
  edgeLogger.info('[join-video-session] Request received', { method: req.method, ipAddress });
  
  if (req.method === 'OPTIONS') {
    edgeLogger.info('[join-video-session] OPTIONS handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    edgeLogger.info('[join-video-session] Processing request');
    const supabase = createAdminClient();
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      edgeLogger.logOperation({
        ip_address: ipAddress,
        operation: 'join-video-session',
        success: false,
        duration_ms: Date.now() - startTime,
        metadata: { error: 'Authentication failed' }
      });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { sessionId } = await req.json();
    
    edgeLogger.info('join-video-session invoked', {
      sessionId,
      timestamp: new Date().toISOString()
    });

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    edgeLogger.info('[join-video-session] Request details', { sessionId, authUserId: user.id });

    // Check for active impersonation session
    let effectiveUserId = user.id;
    const { data: impersonationSession, error: impersonationError } = await supabase
      .from('active_impersonation_sessions')
      .select('impersonated_user_id')
      .eq('admin_user_id', user.id)
      .eq('revoked', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (impersonationError) {
      edgeLogger.warn('[join-video-session] Impersonation check failed (continuing as normal user)', { error: impersonationError.message });
    } else if (impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      edgeLogger.info('[join-video-session] Impersonation detected', { adminUserId: user.id, effectiveUserId });
    }

    edgeLogger.info('[join-video-session] Using effective user ID', { effectiveUserId });

    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      edgeLogger.error('[join-video-session] Session query error', sessionError);
      return new Response(JSON.stringify({ 
        error: 'Unable to find session',
        details: sessionError.message 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!session) {
      edgeLogger.error('[join-video-session] Session not found', undefined, { sessionId });
      return new Response(JSON.stringify({ 
        error: 'Video session not found. It may have been ended or does not exist.' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    edgeLogger.info('[join-video-session] Session found', { sessionId, status: session.status });

    // Verify user authorization - properly resolve user_ids
    // Fetch provider to get user_id
    const { data: provider } = await supabase
      .from('providers')
      .select('user_id')
      .eq('id', session.provider_id)
      .maybeSingle();

    // Fetch patient account to get user_id  
    const { data: patientAccount } = await supabase
      .from('patient_accounts')
      .select('user_id')
      .eq('id', session.patient_id)
      .maybeSingle();

    // Check if user is a system admin
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    const isProvider = provider?.user_id === effectiveUserId;
    const isPatient = patientAccount?.user_id === effectiveUserId;
    const isSystemAdmin = userRole?.role === 'admin';
    // Check if effectiveUserId is a practice that owns this session
    const isPracticeAdmin = effectiveUserId === session.practice_id;
    
    edgeLogger.info('👤 [join-video-session] User role check', {
      effectiveUserId,
      isProvider,
      isPatient,
      isSystemAdmin,
      isPracticeAdmin,
      sessionPracticeId: session.practice_id
    });

    if (!isProvider && !isPatient && !isSystemAdmin && !isPracticeAdmin) {
      edgeLogger.error('❌ [join-video-session] Not authorized', {
        effectiveUserId, 
        sessionId,
        isProvider,
        isPatient,
        isSystemAdmin,
        isPracticeAdmin 
      });
      return new Response(JSON.stringify({ error: 'Not authorized for this session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    edgeLogger.info('✅ [join-video-session] Authorization successful');

    // Check session status
    if (!['waiting', 'active'].includes(session.status)) {
      return new Response(JSON.stringify({ 
        error: `Session is ${session.status}. Cannot join at this time.` 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update participant join timestamp
    const updateFields: any = {};
    // System admins, providers, and practice admins join as providers
    if (isProvider || isSystemAdmin || isPracticeAdmin) {
      updateFields.provider_joined_at = new Date().toISOString();
      // Provider joining makes session active
      if (session.status === 'waiting') {
        updateFields.status = 'active';
      }
    } else {
      updateFields.patient_joined_at = new Date().toISOString();
    }

    const { data: updatedSession, error: updateError } = await supabase
      .from('video_sessions')
      .update(updateFields)
      .eq('id', sessionId)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log join event
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'join',
      user_id: user.id,
      user_type: (isProvider || isSystemAdmin || isPracticeAdmin) ? 'provider' : 'patient',
      event_data: { 
        joined_at: new Date().toISOString(),
        new_status: updateFields.status || session.status,
        impersonated: effectiveUserId !== user.id
      }
    });

    edgeLogger.info('✅ [join-video-session] Session joined successfully', {
      sessionId, 
      role: (isProvider || isSystemAdmin || isPracticeAdmin) ? 'provider' : 'patient',
      impersonated: effectiveUserId !== user.id
    });

    // Generate Agora token for this user
    edgeLogger.info('🎫 [join-video-session] Generating Agora token...');
    const { data: tokenData, error: tokenError } = await supabase.functions.invoke('generate-agora-token', {
      body: {
        sessionId,
        role: 'publisher' // Both provider and patient can publish
      },
      headers: {
        Authorization: authHeader
      }
    });

    if (tokenError) {
      edgeLogger.error('❌ [join-video-session] Token generation failed', tokenError);
      const errorDetails = tokenError.context || tokenError.details || tokenError.message;
      return new Response(JSON.stringify({ 
        error: 'Failed to generate video token',
        details: errorDetails,
        message: `Token generation error: ${tokenError.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!tokenData) {
      edgeLogger.error('❌ [join-video-session] No token data received');
      return new Response(JSON.stringify({ 
        error: 'Failed to generate video token',
        details: 'No data received from token generation service',
        message: 'Token generation returned empty response'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    edgeLogger.info('✅ [join-video-session] Token generated successfully');

    // Enhanced diagnostic logging for comparison with frontend
    edgeLogger.info('=== TOKEN GENERATION PARAMETERS (BACKEND) ===');
    edgeLogger.info('Backend Parameters (used to generate token)', {
      appId: tokenData.appId,
      channel: tokenData.channelName,
      uid: tokenData.uid,
      rtcTokenLen: tokenData.token.length,
      rtcTokenPrefix: tokenData.token.slice(0, 15),
      rtcTokenStartsWith007: tokenData.token.startsWith('007'),
      rtmTokenLen: tokenData.rtmToken.length,
      rtmTokenPrefix: tokenData.rtmToken.slice(0, 15),
      rtmTokenStartsWith007: tokenData.rtmToken.startsWith('007'),
      rtmUid: tokenData.rtmUid,
      cert8: agoraAppCertificate?.slice(0, 8) || 'not-set',
      note: 'Frontend should log IDENTICAL values when client.join() is called'
    });
    edgeLogger.info('[join-video-session] Session joined successfully', {
      sessionId,
      channelName: tokenData.channelName
    });

    // Log successful operation
    edgeLogger.logOperation({
      user_id: effectiveUserId,
      ip_address: ipAddress,
      operation: 'join-video-session',
      success: true,
      duration_ms: Date.now() - startTime,
      metadata: {
        session_id: sessionId,
        channel_name: tokenData.channelName,
        uid: tokenData.uid
      }
    });

    // Audit log for video session access
    await supabase.from('audit_logs').insert({
      action_type: 'video_session_joined',
      user_id: effectiveUserId,
      entity_type: 'video_sessions',
      entity_id: sessionId,
      ip_address: ipAddress,
      details: {
        channel_name: tokenData.channelName,
        uid: tokenData.uid,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      session: updatedSession,
      token: tokenData.token,
      channelName: tokenData.channelName,
      uid: tokenData.uid,
      appId: tokenData.appId,
      rtmToken: tokenData.rtmToken,
      rtmUid: tokenData.rtmUid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    edgeLogger.error('❌ [join-video-session] Unexpected error', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to join video session';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: 'An unexpected error occurred while joining the session'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
