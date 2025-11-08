import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Agora role constants
const RTC_ROLE = {
  PUBLISHER: 1,
  SUBSCRIBER: 2
};

// Helper function to convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Helper function to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Helper function to pack uint32 in big-endian
function packUint32(num: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = (num >> 24) & 0xff;
  buffer[1] = (num >> 16) & 0xff;
  buffer[2] = (num >> 8) & 0xff;
  buffer[3] = num & 0xff;
  return buffer;
}

// Helper function to pack uint16 in big-endian
function packUint16(num: number): Uint8Array {
  const buffer = new Uint8Array(2);
  buffer[0] = (num >> 8) & 0xff;
  buffer[1] = num & 0xff;
  return buffer;
}

// Helper function to concatenate Uint8Arrays
function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Base64 encode using standard base64 (not URL-safe)
function base64Encode(data: Uint8Array): string {
  const binString = Array.from(data, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

// Generate HMAC-SHA256 signature using Web Crypto API
async function hmacSha256(key: string, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    stringToUint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

// Generate RTC Token
async function generateRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  role: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const randomInt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  // Pack message
  const message = concatUint8Arrays(
    stringToUint8Array(appId),
    stringToUint8Array(channelName),
    stringToUint8Array(uid),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint32(privilegeExpiredTs), // Join channel privilege
    packUint16(role)
  );
  
  // Generate signature
  const signature = await hmacSha256(appCertificate, message);
  
  // Pack token content
  const content = concatUint8Arrays(
    stringToUint8Array(appId),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint16(signature.length),
    signature,
    packUint32(privilegeExpiredTs), // crc_channel_name + crc_uid
    packUint16(channelName.length),
    stringToUint8Array(channelName),
    packUint16(uid.length),
    stringToUint8Array(uid)
  );
  
  const token = version + base64Encode(content);
  return token;
}

// Generate RTM Token
async function generateRtmToken(
  appId: string,
  appCertificate: string,
  userId: string,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const randomInt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  // Pack message
  const message = concatUint8Arrays(
    stringToUint8Array(appId),
    stringToUint8Array(userId),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint32(privilegeExpiredTs) // Login privilege
  );
  
  // Generate signature
  const signature = await hmacSha256(appCertificate, message);
  
  // Pack token content
  const content = concatUint8Arrays(
    stringToUint8Array(appId),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint16(signature.length),
    signature,
    packUint16(userId.length),
    stringToUint8Array(userId)
  );
  
  const token = version + base64Encode(content);
  return token;
}

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
    const uid = effectiveUserId.replace(/-/g, '').substring(0, 32); // Convert UUID to string
    const userRole = role === 'publisher' ? RTC_ROLE.PUBLISHER : RTC_ROLE.SUBSCRIBER;
    const expirationTimeInSeconds = 86400; // 24 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    console.log('🎫 [generate-agora-token] Generating tokens...', { channelName, uid, role: userRole });

    // Generate RTC token
    const rtcToken = await generateRtcToken(
      appId,
      appCertificate,
      channelName,
      uid,
      userRole,
      privilegeExpiredTs
    );

    // Generate RTM token
    const rtmToken = await generateRtmToken(
      appId,
      appCertificate,
      uid,
      privilegeExpiredTs
    );

    console.log('✅ [generate-agora-token] Tokens generated successfully');

    // Log token generation
    await supabase.from('video_session_logs').insert({
      session_id: sessionId,
      event_type: 'token_generated',
      user_id: user.id,
      user_type: (isProvider || isPracticeAdmin) ? 'provider' : 'patient',
      event_data: { 
        role, 
        expires_at: new Date(privilegeExpiredTs * 1000).toISOString(),
        impersonated: effectiveUserId !== user.id
      }
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
    console.error('❌ [generate-agora-token] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
