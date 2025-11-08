import { corsHeaders } from '../_shared/cors.ts';

// This is a PUBLIC diagnostic function for testing Agora configuration
// It validates credentials and generates test tokens without requiring authentication

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

// Base64 encode
function base64Encode(data: Uint8Array): string {
  const binString = Array.from(data, (byte) => String.fromCodePoint(byte)).join("");
  return btoa(binString);
}

// Generate HMAC-SHA256 signature
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

// Generate test RTC token
async function generateTestRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const randomInt = Math.floor(Math.random() * 0xFFFFFFFF);
  const uidStr = uid.toString();
  const role = 1; // PUBLISHER
  
  const message = concatUint8Arrays(
    stringToUint8Array(appId),
    stringToUint8Array(channelName),
    stringToUint8Array(uidStr),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint32(privilegeExpiredTs),
    packUint16(role)
  );
  
  const signature = await hmacSha256(appCertificate, message);
  
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
  
  return version + base64Encode(content);
}

// Generate test RTM token
async function generateTestRtmToken(
  appId: string,
  appCertificate: string,
  uid: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const randomInt = Math.floor(Math.random() * 0xFFFFFFFF);
  const uidStr = uid.toString();
  
  const message = concatUint8Arrays(
    stringToUint8Array(appId),
    stringToUint8Array(uidStr),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint32(privilegeExpiredTs)
  );
  
  const signature = await hmacSha256(appCertificate, message);
  
  const content = concatUint8Arrays(
    stringToUint8Array(appId),
    packUint32(randomInt),
    packUint32(privilegeExpiredTs),
    packUint16(signature.length),
    signature,
    packUint16(uidStr.length),
    stringToUint8Array(uidStr)
  );
  
  return version + base64Encode(content);
}

Deno.serve(async (req) => {
  console.log('🧪 [video-agora-selftest] Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Agora credentials
    const appId = Deno.env.get('AGORA_APP_ID');
    const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');
    
    if (!appId || !appCertificate) {
      console.error('❌ Missing Agora credentials');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Agora credentials not configured',
        details: {
          hasAppId: !!appId,
          hasCertificate: !!appCertificate
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate format (32 hex characters)
    const hexPattern = /^[0-9a-f]{32}$/i;
    const appIdValid = hexPattern.test(appId);
    const certValid = hexPattern.test(appCertificate);
    
    if (!appIdValid || !certValid) {
      console.error('❌ Invalid credential format');
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Invalid Agora credential format',
        details: {
          appIdValid,
          appIdLength: appId.length,
          appIdSample: appId.substring(0, 8) + '...',
          certValid,
          certLength: appCertificate.length,
          expectedFormat: '32 hexadecimal characters'
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate test tokens
    const testChannel = `selftest_${new Date().toISOString().split('T')[0]}`;
    const testUid = 12345;
    const expirationTime = 300; // 5 minutes
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTime;

    console.log('🎫 Generating test tokens...', { testChannel, testUid });

    const rtcToken = await generateTestRtcToken(
      appId,
      appCertificate,
      testChannel,
      testUid,
      privilegeExpiredTs
    );

    const rtmToken = await generateTestRtmToken(
      appId,
      appCertificate,
      testUid,
      privilegeExpiredTs
    );

    console.log('✅ Test tokens generated successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Agora credentials validated and test tokens generated',
      credentials: {
        appIdLength: appId.length,
        appIdSample: appId.substring(0, 8) + '...',
        appIdValid,
        certLength: appCertificate.length,
        certValid
      },
      testTokens: {
        channelName: testChannel,
        uid: testUid,
        rtcTokenLength: rtcToken.length,
        rtcTokenPreview: rtcToken.substring(0, 30) + '...',
        rtmTokenLength: rtmToken.length,
        rtmTokenPreview: rtmToken.substring(0, 30) + '...',
        expiresIn: expirationTime,
        expiresAt: new Date(privilegeExpiredTs * 1000).toISOString()
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ [video-agora-selftest] Error:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
