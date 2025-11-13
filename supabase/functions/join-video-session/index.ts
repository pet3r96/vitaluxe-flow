import { createAdminClient } from '../_shared/supabaseAdmin.ts';
import { corsHeaders } from '../_shared/cors.ts';

const agoraAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

Deno.serve(async (req) => {
  console.log('🚀 [join-video-session] Request received', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ [join-video-session] OPTIONS handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [join-video-session] Processing request...');
    const supabase = createAdminClient();
    
    // Authenticate user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { sessionId } = await req.json();
    
    console.log("join-video-session invoked", {
      sessionId,
      timestamp: new Date().toISOString()
    });

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 [join-video-session] Request:', { sessionId, authUserId: user.id });

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
      console.warn('⚠️ [join-video-session] Impersonation check failed (continuing as normal user):', impersonationError.message);
    } else if (impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      console.log('👥 [join-video-session] Impersonation detected:', { 
        adminUserId: user.id, 
        effectiveUserId 
      });
    }

    console.log('✅ [join-video-session] Using effective user ID:', effectiveUserId);

    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('❌ [join-video-session] Session query error:', sessionError);
      return new Response(JSON.stringify({ 
        error: 'Unable to find session',
        details: sessionError.message 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!session) {
      console.error('❌ [join-video-session] Session not found:', sessionId);
      return new Response(JSON.stringify({ 
        error: 'Video session not found. It may have been ended or does not exist.' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [join-video-session] Session found:', { sessionId, status: session.status });

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
    
    console.log('👤 [join-video-session] User role check:', { 
      effectiveUserId,
      isProvider,
      isPatient,
      isSystemAdmin,
      isPracticeAdmin,
      sessionPracticeId: session.practice_id
    });

    if (!isProvider && !isPatient && !isSystemAdmin && !isPracticeAdmin) {
      console.error('❌ [join-video-session] Not authorized:', { 
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

    console.log('✅ [join-video-session] Authorization successful');

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

    console.log('✅ [join-video-session] Session joined successfully:', { 
      sessionId, 
      role: (isProvider || isSystemAdmin || isPracticeAdmin) ? 'provider' : 'patient',
      impersonated: effectiveUserId !== user.id
    });

    // Generate Agora token for this user
    console.log('🎫 [join-video-session] Generating Agora token...');
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
      console.error('❌ [join-video-session] Token generation failed:', tokenError);
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
      console.error('❌ [join-video-session] No token data received');
      return new Response(JSON.stringify({ 
        error: 'Failed to generate video token',
        details: 'No data received from token generation service',
        message: 'Token generation returned empty response'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [join-video-session] Token generated successfully');

    // Enhanced diagnostic logging for comparison with frontend
    console.log('=== TOKEN GENERATION PARAMETERS (BACKEND) ===');
    console.log('Backend Parameters (used to generate token):');
    console.log('  [BE] appId:', tokenData.appId);
    console.log('  [BE] channel:', tokenData.channelName);
    console.log('  [BE] uid:', tokenData.uid);
    console.log('  [BE] rtcToken.len:', tokenData.token.length);
    console.log('  [BE] rtcToken.prefix:', tokenData.token.slice(0, 15));
    console.log('  [BE] rtcToken starts with 007:', tokenData.token.startsWith('007'));
    console.log('  [BE] rtmToken.len:', tokenData.rtmToken.length);
    console.log('  [BE] rtmToken.prefix:', tokenData.rtmToken.slice(0, 15));
    console.log('  [BE] rtmToken starts with 007:', tokenData.rtmToken.startsWith('007'));
    console.log('  [BE] rtmUid:', tokenData.rtmUid);
    console.log('  [BE] Cert8:', agoraAppCertificate?.slice(0, 8) || 'not-set');
    console.log('  NOTE: Frontend should log IDENTICAL values when client.join() is called');
    console.log('=============================================');

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
    console.error('❌ [join-video-session] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Failed to join video session',
      details: 'An unexpected error occurred while joining the session'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
