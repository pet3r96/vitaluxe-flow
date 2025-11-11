// Deno-native Agora AccessToken2 implementation using Web Crypto API
// Implements service-based architecture with proper HMAC-SHA256 signing

interface AgoraCredentials {
  appId: string;
  appCertificate: string;
}

function getAgoraCredentials(): AgoraCredentials {
  const appId = Deno.env.get('AGORA_APP_ID');
  const appCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

  if (!appId || !appCertificate) {
    throw new Error('Missing Agora credentials in environment');
  }

  if (appId.length !== 32) {
    throw new Error(`Invalid Agora App ID format: expected 32 chars, got ${appId.length}`);
  }

  if (appCertificate.length !== 32) {
    throw new Error(`Invalid Agora Certificate format: expected 32 chars, got ${appCertificate.length}`);
  }

  return { appId, appCertificate };
}

export interface TokenOptions {
  channelName: string;
  uid: string;
  role: 'publisher' | 'subscriber';
  expiresInSeconds?: number;
}

export interface AgoraTokenResult {
  rtcToken: string;
  rtmToken: string;
  rtmUid: string;
  expiresAt: number;
  appId: string;
}

// ============================================================================
// Byte Packing Utilities (Little-Endian)
// ============================================================================

function writeUint16LE(n: number): Uint8Array {
  const v = (n >>> 0) & 0xFFFF;
  const buf = new Uint8Array(2);
  buf[0] = v & 0xFF;
  buf[1] = (v >>> 8) & 0xFF;
  return buf;
}

function writeUint32LE(n: number): Uint8Array {
  const v = n >>> 0;
  const buf = new Uint8Array(4);
  buf[0] = v & 0xFF;
  buf[1] = (v >>> 8) & 0xFF;
  buf[2] = (v >>> 16) & 0xFF;
  buf[3] = (v >>> 24) & 0xFF;
  return buf;
}

function writeStringWithLen(s: string): Uint8Array {
  const utf8 = new TextEncoder().encode(s);
  const len = writeUint16LE(utf8.length);
  return concat(len, utf8);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// hexToBytes removed - certificate should be used as UTF-8 bytes, not hex-decoded

// ============================================================================
// Privilege Constants
// ============================================================================

// RTC Privileges (service type 1)
const kJoinChannel = 1;
const kPublishAudio = 2;
const kPublishVideo = 3;
const kPublishData = 4;

// RTM Privileges (service type 2)
const kRtmLogin = 1;

// ============================================================================
// Service Packing Functions
// ============================================================================

function packPrivilegesMap(privileges: Map<number, number>): Uint8Array {
  const count = writeUint16LE(privileges.size);
  const entries: Uint8Array[] = [count];
  
  for (const [key, expire] of privileges.entries()) {
    entries.push(writeUint16LE(key));
    entries.push(writeUint32LE(expire));
  }
  
  return concat(...entries);
}

// Pack service: type(uint16) + body (NO length field per Agora spec)
function packService(type: number, body: Uint8Array): Uint8Array {
  const typeBytes = writeUint16LE(type);
  return concat(typeBytes, body);
}

function packServiceRtcBody(
  channelName: string,
  userAccount: string,
  role: 'publisher' | 'subscriber',
  expireTimestamp: number
): Uint8Array {
  // Channel and user
  const channelBytes = writeStringWithLen(channelName);
  const userBytes = writeStringWithLen(userAccount);
  
  // Privileges
  const privileges = new Map<number, number>();
  privileges.set(kJoinChannel, expireTimestamp);
  
  if (role === 'publisher') {
    privileges.set(kPublishAudio, expireTimestamp);
    privileges.set(kPublishVideo, expireTimestamp);
    privileges.set(kPublishData, expireTimestamp);
  }
  
  const privilegesBytes = packPrivilegesMap(privileges);
  
  return concat(channelBytes, userBytes, privilegesBytes);
}

function packServiceRtmBody(userId: string, expireTimestamp: number): Uint8Array {
  // User ID
  const userBytes = writeStringWithLen(userId);
  
  // Privileges
  const privileges = new Map<number, number>();
  privileges.set(kRtmLogin, expireTimestamp);
  
  const privilegesBytes = packPrivilegesMap(privileges);
  
  return concat(userBytes, privilegesBytes);
}

// ============================================================================
// Token Generation
// ============================================================================

async function generateAccessToken2(
  appId: string,
  appCertificate: string,
  serviceType: 'rtc' | 'rtm',
  channelName: string,
  uid: string,
  expiresAt: number,
  role: 'publisher' | 'subscriber'
): Promise<string> {
  // Generate random salt
  const salt = crypto.getRandomValues(new Uint32Array(1))[0];
  
  // Current timestamp
  const ts = Math.floor(Date.now() / 1000);
  
  // Build service body
  let serviceBody: Uint8Array;
  let serviceTypeNum: number;
  
  if (serviceType === 'rtc') {
    serviceTypeNum = 1;
    serviceBody = packServiceRtcBody(channelName, uid, role, expiresAt);
  } else {
    serviceTypeNum = 2;
    serviceBody = packServiceRtmBody(uid, expiresAt);
  }
  
  // Pack service: type(uint16) + body (NO length field per Agora spec)
  const servicePack = packService(serviceTypeNum, serviceBody);
  
  // Services: serviceCount(uint16) + service pack
  const servicesPack = concat(writeUint16LE(1), servicePack);
  
  // Build message: salt + ts + services
  const message = concat(
    writeUint32LE(salt),
    writeUint32LE(ts),
    servicesPack
  );
  
  // CRITICAL FIX: Use certificate as UTF-8 bytes (not hex-decoded)
  const keyBytes = new TextEncoder().encode(appCertificate);
  
  // Data to sign: utf8(appId) + message
  const appIdBytes = new TextEncoder().encode(appId);
  const dataToSign = concat(appIdBytes, message);
  
  // HMAC-SHA256 signature
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, dataToSign);
  const signature = new Uint8Array(signatureBuffer);
  
  // Final payload: signature + message
  const payload = concat(signature, message);
  
  // Encode to base64
  const base64Payload = btoa(String.fromCharCode(...payload));
  
  // Return token with "007" prefix
  const token = "007" + base64Payload;

  // Enhanced diagnostic logging
  console.log("\n🔧 [AccessToken2 Builder]");
  console.log("├─ AppID prefix:", appId.substring(0, 8));
  console.log("├─ Cert prefix:", appCertificate.substring(0, 8));
  console.log("├─ Service type:", serviceType, `(${serviceTypeNum})`);
  console.log("├─ Channel:", channelName);
  console.log("├─ UID:", uid);
  console.log("├─ Role:", role);
  console.log("├─ Salt:", salt);
  console.log("├─ Timestamp:", ts);
  console.log("├─ Expires at:", expiresAt, `(${new Date(expiresAt * 1000).toISOString()})`);
  console.log("├─ Service count:", 1);
  
  if (serviceType === 'rtc') {
    console.log("├─ RTC Privileges: JOIN_CHANNEL(1)");
    if (role === 'publisher') {
      console.log("│  ├─ PUBLISH_AUDIO(2)");
      console.log("│  ├─ PUBLISH_VIDEO(3)");
      console.log("│  └─ PUBLISH_DATA_STREAM(4)");
    }
  } else {
    console.log("├─ RTM Privileges: LOGIN(1)");
  }
  
  console.log("├─ Certificate UTF-8 byte count:", keyBytes.length);
  console.log("├─ Service body length:", serviceBody.length, "bytes");
  console.log("├─ Service pack length:", servicePack.length, "bytes");
  console.log("├─ Services pack length:", servicesPack.length, "bytes");
  console.log("├─ Message length:", message.length, "bytes");
  console.log("├─ Signature length:", signature.length, "bytes");
  console.log("├─ Token starts with 007:", token.startsWith("007"));
  console.log("├─ Token length:", token.length);
  console.log("└─ Token prefix:", token.substring(0, 20));
  
  // Byte-level diagnostics
  console.log("\n🔬 [Byte-Level Diagnostics]");
  console.log("├─ First 16 bytes of message (hex):", 
    Array.from(message.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' '));
  console.log("├─ First 16 bytes of signature (hex):", 
    Array.from(signature.slice(0, 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' '));
  console.log("└─ Certificate encoding: UTF-8 (NOT hex-decoded)");

  return token;
}

// ============================================================================
// Public API
// ============================================================================

export async function generateAgoraTokens(options: TokenOptions): Promise<AgoraTokenResult> {
  const { appId, appCertificate } = getAgoraCredentials();
  const expireTimestamp = Math.floor(Date.now() / 1000) + (options.expiresInSeconds ?? 3600);

  console.log("\n=== AGORA TOKEN GENERATION START ===");
  console.log("Channel:", options.channelName);
  console.log("UID:", options.uid);
  console.log("Role:", options.role);
  console.log("Expires in:", options.expiresInSeconds ?? 3600, "seconds");

  // Generate RTC token (ServiceRtc only)
  const rtcToken = await generateAccessToken2(
    appId,
    appCertificate,
    'rtc',
    options.channelName,
    options.uid,
    expireTimestamp,
    options.role
  );

  // Generate RTM token (ServiceRtm only)
  const rtmToken = await generateAccessToken2(
    appId,
    appCertificate,
    'rtm',
    options.channelName,
    options.uid,
    expireTimestamp,
    options.role
  );

  // Verification logging
  console.log("\n=== AGORA TOKEN VERIFICATION ===");
  console.log("AppID:", appId);
  console.log("Cert8:", appCertificate.substring(0, 8));
  console.log("Channel:", options.channelName);
  console.log("UID:", options.uid);
  console.log("Token starts with 007:", rtcToken.startsWith("007"));
  console.log("RTC token prefix:", rtcToken.substring(0, 15));
  console.log("RTC token length:", rtcToken.length);
  console.log("RTM token prefix:", rtmToken.substring(0, 15));
  console.log("RTM token length:", rtmToken.length);
  console.log("Tokens are different:", rtcToken !== rtmToken);
  console.log("ExpiresAt:", expireTimestamp);
  console.log("ExpiresAt ISO:", new Date(expireTimestamp * 1000).toISOString());
  console.log("================================\n");

  return {
    rtcToken,
    rtmToken,
    rtmUid: options.uid,
    expiresAt: expireTimestamp,
    appId,
  };
}

export { getAgoraCredentials };
