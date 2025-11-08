import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Agora role constants
const RTC_ROLE = {
  PUBLISHER: 1,
  SUBSCRIBER: 2
};

// Generate a deterministic numeric UID from user ID and session ID
function generateNumericUid(userId: string, sessionId: string): number {
  // Create a simple hash by combining user and session IDs
  const combined = userId + sessionId;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Return absolute value to ensure positive number, keep it reasonable size (max 10 digits)
  return Math.abs(hash) % 2147483647; // Max 32-bit signed int
}

// Helper function to convert string to Uint8Array
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
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

// Generate RTC Token with numeric UID
async function generateRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  role: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const randomInt = Math.floor(Math.random() * 0xFFFFFFFF);
  
  // Convert numeric UID to string for token generation
  const uidStr = uid.toString();
  
  // Pack message
  const message = concatUint8Arrays(
    stringToUint8Array(appId),
    stringToUint8Array(channelName),
    stringToUint8Array(uidStr),
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
    packUint32(privilegeExpiredTs),
    packUint16(channelName.length),
    stringToUint8Array(channelName),
    packUint16(uidStr.length),
    stringToUint8Array(uidStr)
  );
  
  const token = version + base64Encode(content);
  return token;
}

// Generate RTM Token with numeric UID
async function generateRtmToken(
  appId: string,
  appCertificate: string,
  uid: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const randomInt = Math.floor(Math.random() * 0xFFFFFFFF);
  const uidStr = uid.toString();
  
  // Pack message
  const message = concatUint8Arrays(
    stringToUint8Array(appId),
    stringToUint8Array(uidStr),
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
    packUint16(uidStr.length),
    stringToUint8Array(uidStr)
  );
  
  const token = version + base64Encode(content);
  return token;
}

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

    // Get Agora credentials from environment
    const appId = Deno.env.get('AGORA_APP_ID')!;
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE')!;
    
    if (!appId || !appCertificate) {
      console.error('❌ Missing Agora credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate Agora credentials format (must be 32 hex characters)
    if (!/^[0-9a-f]{32}$/i.test(appId)) {
      console.error('❌ Invalid AGORA_APP_ID format:', { 
        length: appId.length, 
        sample: appId.substring(0, 8) + '...'
      });
      return new Response(JSON.stringify({ error: 'Invalid Agora configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!/^[0-9a-f]{32}$/i.test(appCertificate)) {
      console.error('❌ Invalid AGORA_APP_CERTIFICATE format:', { 
        length: appCertificate.length 
      });
      return new Response(JSON.stringify({ error: 'Invalid Agora configuration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Agora credentials validated:', {
      appIdLength: appId.length,
      appIdSample: appId.substring(0, 8) + '...',
      certLength: appCertificate.length
    });

    const channelName = session.channel_name;
    const uid = generateNumericUid(effectiveUserId, sessionId);
    const userRole = RTC_ROLE.PUBLISHER; // Both provider and patient can publish
    const expirationTimeInSeconds = 7200; // 2 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    console.log('🎫 [generate-agora-token] Generating tokens...', { 
      channelName, 
      uid,
      uidType: typeof uid,
      role: userRole,
      effectiveUserId: effectiveUserId.substring(0, 8) + '...'
    });

    console.log('🔍 [FULL TOKEN DEBUG]', {
      effectiveUserId: effectiveUserId.substring(0, 8) + '...',
      sessionId,
      channelName,
      channelNameLength: channelName.length,
      uid,
      uidType: typeof uid,
      uidValue: uid,
      uidLength: uid.toString().length,
      appIdLength: appId.length,
      appCertLength: appCertificate.length,
      expirationTime: expirationTimeInSeconds,
      privilegeExpiredTs
    });

    // Generate RTC token with numeric UID
    const rtcToken = await generateRtcToken(
      appId,
      appCertificate,
      channelName,
      uid,
      userRole,
      privilegeExpiredTs
    );

    // Generate RTM token with numeric UID
    const rtmToken = await generateRtmToken(
      appId,
      appCertificate,
      uid,
      privilegeExpiredTs
    );

    console.log('✅ [generate-agora-token] Tokens generated successfully', {
      rtcTokenLength: rtcToken.length,
      rtcTokenPreview: rtcToken.substring(0, 20) + '...',
      rtmTokenLength: rtmToken.length,
      rtmTokenPreview: rtmToken.substring(0, 20) + '...'
    });

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
      uid, // Return numeric UID
      appId,
      expiresAt: privilegeExpiredTs,
      rtmToken,
      rtmUid: uid.toString() // RTM needs string UID
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
