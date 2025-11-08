import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } from 'https://esm.sh/agora-access-token@2.0.4';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const isProvider = provider?.user_id === user.id;
    const isPatient = patientAccount?.user_id === user.id;
    
    if (!isProvider && !isPatient) {
      return new Response(JSON.stringify({ error: 'Not authorized for this session' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get Agora credentials from environment
    const appId = Deno.env.get('AGORA_APP_ID')!;
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')!;
    
    if (!appId || !appCertificate) {
      console.error('Missing Agora credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const channelName = session.channel_name;
    const uid = user.id.replace(/-/g, '').substring(0, 32); // Convert UUID to numeric string
    const userRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 86400; // 24 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    // Generate RTC token
    const rtcToken = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      userRole,
      privilegeExpiredTs
    );

    // Generate RTM token
    const rtmToken = RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      uid,
      RtmRole.Rtm_User,
      privilegeExpiredTs
    );

    // Log token generation
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'token_generated',
      user_id: user.id,
      user_type: isProvider ? 'provider' : 'patient',
      event_data: { role, expires_at: new Date(privilegeExpiredTs * 1000).toISOString() }
    });

    return new Response(JSON.stringify({
      token: rtcToken,
      channelName,
      uid,
      appId,
      expiresAt: privilegeExpiredTs,
      rtmToken,
      rtmUid: uid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error generating Agora token:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
