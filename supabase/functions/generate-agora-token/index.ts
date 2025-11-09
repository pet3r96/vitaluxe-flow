import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
import { generateAgoraTokens } from '../_shared/agoraTokens.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  console.log('🚀 [generate-agora-token] Request received', req.method);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ [generate-agora-token] OPTIONS handled');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 [generate-agora-token] Processing request...');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
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

    const { sessionId, role = 'publisher' } = await req.json();

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 [generate-agora-token] Request:', { sessionId, authUserId: user.id });

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
      console.warn('⚠️ [generate-agora-token] Impersonation check failed (continuing as normal user):', impersonationError.message);
    } else if (impersonationSession?.impersonated_user_id) {
      effectiveUserId = impersonationSession.impersonated_user_id;
      console.log('👥 [generate-agora-token] Impersonation detected:', { 
        adminUserId: user.id, 
        effectiveUserId 
      });
    }

    console.log('✅ [generate-agora-token] Using effective user ID:', effectiveUserId);

    // Fetch session details
    const { data: session, error: sessionError } = await supabase
      .from('video_sessions')
      .select('*, patient_appointments!inner(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

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

    const isProvider = provider?.user_id === effectiveUserId;
    const isPatient = patientAccount?.user_id === effectiveUserId;
    const isPracticeAdmin = session.practice_id === effectiveUserId;
    
    console.log('👤 [generate-agora-token] User role check:', { 
      effectiveUserId,
      isProvider,
      isPatient,
      isPracticeAdmin,
      sessionPracticeId: session.practice_id
    });
    
    if (!isProvider && !isPatient && !isPracticeAdmin) {
      console.error('❌ [generate-agora-token] Not authorized:', { effectiveUserId, sessionId });
      return new Response(JSON.stringify({ error: 'Not authorized for this session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ [generate-agora-token] Authorization successful');

    const channelName = session.channel_name;
    const uid = effectiveUserId;
    const tokenRole = role === 'publisher' ? 'publisher' : 'subscriber';

    console.log('🎫 [generate-agora-token] Generating tokens...', { channelName, uid, role: tokenRole });

    const tokens = await generateAgoraTokens({
      channelName,
      uid: String(uid),
      role: tokenRole,
      expiresInSeconds: 3600,
    });
    const appId = tokens.appId;

    console.log('✅ [generate-agora-token] Tokens generated successfully');
    console.log('🔑 [generate-agora-token] RTC Token Details:');
    console.log('   - Full Token:', tokens.rtcToken);
    console.log('   - Token Length:', tokens.rtcToken.length);
    console.log('   - First 50 chars:', tokens.rtcToken.substring(0, 50));
    console.log('   - Starts with 007:', tokens.rtcToken.startsWith('007'));
    console.log('   - AppId used:', tokens.appId);
    console.log('   - Channel:', channelName);
    console.log('   - UID:', String(uid));
    console.log('🔑 [generate-agora-token] RTM Token Details:');
    console.log('   - Full Token:', tokens.rtmToken);
    console.log('   - Token Length:', tokens.rtmToken.length);
    console.log('   - First 50 chars:', tokens.rtmToken.substring(0, 50));

    // Log token generation
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'token_generated',
      user_id: user.id,
      user_type: (isProvider || isPracticeAdmin) ? 'provider' : 'patient',
      event_data: { 
        role, 
        expires_at: new Date(tokens.expiresAt * 1000).toISOString(),
        impersonated: effectiveUserId !== user.id
      }
    });

    return new Response(JSON.stringify({
      token: tokens.rtcToken,
      channelName,
      uid: tokens.rtmUid,
      appId,
      expiresAt: tokens.expiresAt,
      rtmToken: tokens.rtmToken,
      rtmUid: tokens.rtmUid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [generate-agora-token] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
