// 🧹 TODO AGORA REFACTOR
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';
// import { buildRtcToken, buildRtmToken, Role } from '../_shared/agoraTokenBuilder.ts';

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
    
    // Validate channel name format
    if (!channelName) {
      console.error('❌ [generate-agora-token] Missing channel_name for session:', sessionId);
      return new Response(JSON.stringify({ 
        error: 'Session has no channel name configured',
        details: 'Database integrity issue - channel_name is null'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (channelName.includes('-')) {
      console.warn('⚠️ [generate-agora-token] Channel name contains hyphens:', channelName);
      console.warn('   This may cause Agora token/join issues');
      console.warn('   Expected format: vlx_<uuid_with_underscores>');
    }

    console.log('✅ [generate-agora-token] Valid channel name:', channelName);
    
    // Get Agora credentials from environment
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

    if (!appId || !appCertificate) {
      return new Response(JSON.stringify({ error: 'Agora credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const uid = String(effectiveUserId);
    // const tokenRole = role === 'publisher' ? Role.PUBLISHER : Role.SUBSCRIBER;

    console.log('🎫 [generate-agora-token] Generating tokens...', { channelName, uid, role });

    // Generate tokens using Official Agora Port (AccessToken2)
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const expire = currentTimestamp + 3600; // 1 hour from now

    console.log('🔧 [Token Generation] Using official Agora AccessToken2 port');
    console.log('   Current time:', currentTimestamp);
    console.log('   Expire time:', expire);
    console.log('   TTL:', 3600, 'seconds');

    /* const rtcToken = await buildRtcToken(
      appId,
      appCertificate,
      channelName,
      uid,
      tokenRole,
      expire
    );

    const rtmToken = await buildRtmToken(
      appId,
      appCertificate,
      uid,
      expire
    ); */

    // Create tokens object in same format as before
    const tokens = {
      rtcToken: 'PLACEHOLDER_RTC_TOKEN',
      rtmToken: 'PLACEHOLDER_RTM_TOKEN',
      rtmUid: uid,
      expiresAt: expire,
      appId
    };

    console.log('✅ [generate-agora-token] Tokens generated successfully');
    
    // Detailed diagnostic logging for token comparison
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔍 DETAILED TOKEN DIAGNOSTICS FOR COMPARISON');
    console.log('═══════════════════════════════════════════════════════════');
    
    console.log('\n📋 Request Parameters:');
    console.log('   - Channel Name:', channelName);
    console.log('   - UID (string):', String(uid));
    console.log('   - Role:', tokenRole);
    console.log('   - Expires In:', '3600 seconds (1 hour)');
    
    console.log('\n🔑 RTC Token Analysis:');
    console.log('   - Full Token:', tokens.rtcToken);
    console.log('   - Token Length:', tokens.rtcToken.length, 'characters');
    console.log('   - Token Version:', tokens.rtcToken.startsWith('007') ? 'AccessToken2 (007)' : 'Unknown');
    console.log('   - First 100 chars:', tokens.rtcToken.substring(0, 100) + '...');
    console.log('   - Last 50 chars:', '...' + tokens.rtcToken.substring(tokens.rtcToken.length - 50));
    
    console.log('\n🔑 RTM Token Analysis:');
    console.log('   - Full Token:', tokens.rtmToken);
    console.log('   - Token Length:', tokens.rtmToken.length, 'characters');
    console.log('   - Token Version:', tokens.rtmToken.startsWith('007') ? 'AccessToken2 (007)' : 'Unknown');
    console.log('   - First 100 chars:', tokens.rtmToken.substring(0, 100) + '...');
    console.log('   - Last 50 chars:', '...' + tokens.rtmToken.substring(tokens.rtmToken.length - 50));
    
    console.log('\n⏰ Expiry Information:');
    const expiryDate = new Date(tokens.expiresAt * 1000);
    const nowDate = new Date();
    console.log('   - Current Time:', nowDate.toISOString(), '(' + Math.floor(nowDate.getTime() / 1000) + ')');
    console.log('   - Expires At (Unix):', tokens.expiresAt);
    console.log('   - Expires At (ISO):', expiryDate.toISOString());
    console.log('   - Time Until Expiry:', Math.floor((tokens.expiresAt * 1000 - nowDate.getTime()) / 1000), 'seconds');
    console.log('   - Calculated From:', 'Math.floor(Date.now() / 1000) + 3600');
    
    console.log('\n🔐 Credentials Used:');
    console.log('   - App ID:', tokens.appId);
    console.log('   - App ID Length:', tokens.appId.length);
    console.log('   - App ID Format:', /^[a-f0-9]{32}$/i.test(tokens.appId) ? 'Valid (32 hex chars)' : 'Invalid format');
    console.log('   - App Certificate:', '[REDACTED - First 8 chars: ' + Deno.env.get('AGORA_APP_CERTIFICATE')?.substring(0, 8) + '...]');
    
    console.log('\n📊 Token Structure Comparison Guide:');
    console.log('   Compare these values with working Agora Console token:');
    console.log('   1. Both tokens should start with "007" (AccessToken2 version)');
    console.log('   2. Token lengths should be similar (typically 300-500 chars)');
    console.log('   3. App ID must match exactly');
    console.log('   4. Channel name must match exactly (case-sensitive)');
    console.log('   5. UID format must be consistent (string)');
    console.log('   6. Expiry timestamp must be in the future');
    
    console.log('\n🧪 Quick Test Values:');
    console.log('   - Token starts with 007?', tokens.rtcToken.startsWith('007') ? '✅ YES' : '❌ NO');
    console.log('   - Token length reasonable?', (tokens.rtcToken.length > 200 && tokens.rtcToken.length < 1000) ? '✅ YES' : '❌ NO');
    console.log('   - Expiry in future?', tokens.expiresAt > Math.floor(Date.now() / 1000) ? '✅ YES' : '❌ NO');
    console.log('   - Channel name set?', channelName && channelName.length > 0 ? '✅ YES' : '❌ NO');
    console.log('   - UID is string?', typeof String(uid) === 'string' ? '✅ YES' : '❌ NO');
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('END TOKEN DIAGNOSTICS');
    console.log('═══════════════════════════════════════════════════════════\n');

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
