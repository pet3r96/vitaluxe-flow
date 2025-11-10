// Native Deno implementation of Agora AccessToken2 (007 format)
// Using Web Crypto API instead of Node.js crypto module

const HEX_32_REGEX = /^[a-f0-9]{32}$/i;

// AccessToken2 Service Types
const SERVICE_RTC = 1;
const SERVICE_RTM = 2;

// RTC Privileges
const PRIVILEGE_JOIN_CHANNEL = 1;
const PRIVILEGE_PUBLISH_AUDIO = 2;
const PRIVILEGE_PUBLISH_VIDEO = 3;
const PRIVILEGE_PUBLISH_DATA = 4;

export interface AgoraCredentials {
  appId: string;
  appCertificate: string;
}

export function getAgoraCredentials(): AgoraCredentials {
  const rawAppId = Deno.env.get('AGORA_APP_ID');
  const rawAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

  if (!rawAppId || !rawAppCertificate) {
    throw new Error('Missing Agora credentials');
  }

  const appId = rawAppId.trim();
  const appCertificate = rawAppCertificate.trim();

  if (!HEX_32_REGEX.test(appId) || !HEX_32_REGEX.test(appCertificate)) {
    throw new Error('Invalid Agora credential format');
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
  rtmToken: string; // Same as rtcToken for new Signaling system
  rtmUid: string;
  expiresAt: number;
  appId: string;
}

// Helper function to pack uint16 (little-endian)
function packUint16(value: number): Uint8Array {
  const buffer = new Uint8Array(2);
  buffer[0] = value & 0xFF;
  buffer[1] = (value >> 8) & 0xFF;
  return buffer;
}

// Helper function to pack uint32 (little-endian)
function packUint32(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = value & 0xFF;
  buffer[1] = (value >> 8) & 0xFF;
  buffer[2] = (value >> 16) & 0xFF;
  buffer[3] = (value >> 24) & 0xFF;
  return buffer;
}

// Helper function to pack string
function packString(str: string): Uint8Array {
  const encoded = new TextEncoder().encode(str);
  const length = packUint16(encoded.length);
  const result = new Uint8Array(length.length + encoded.length);
  result.set(length, 0);
  result.set(encoded, length.length);
  return result;
}

// Helper function to concatenate Uint8Arrays
function concatArrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// HMAC-SHA256 using Web Crypto API
async function hmacSign(key: string, message: Uint8Array): Promise<Uint8Array> {
  const keyData = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

// Build AccessToken2 message to sign
function buildMessage(
  appId: string,
  channelName: string,
  uid: string,
  salt: number,
  expireTimestamp: number
): Uint8Array {
  const isPublisher = true; // Both roles can publish
  
  // Pack RTC service
  const serviceType = packUint16(SERVICE_RTC);
  
  // Pack privileges for RTC
  const privileges = new Map<number, number>();
  privileges.set(PRIVILEGE_JOIN_CHANNEL, expireTimestamp);
  if (isPublisher) {
    privileges.set(PRIVILEGE_PUBLISH_AUDIO, expireTimestamp);
    privileges.set(PRIVILEGE_PUBLISH_VIDEO, expireTimestamp);
    privileges.set(PRIVILEGE_PUBLISH_DATA, expireTimestamp);
  }
  
  // Pack privilege map
  const privilegeCount = packUint16(privileges.size);
  const privilegeData: Uint8Array[] = [privilegeCount];
  
  for (const [key, value] of privileges) {
    privilegeData.push(packUint16(key));
    privilegeData.push(packUint32(value));
  }
  
  const packedPrivileges = concatArrays(...privilegeData);
  
  // Build message: appId + channelName + uid + salt + expireTimestamp + service + privileges
  return concatArrays(
    packString(appId),
    packString(channelName),
    packString(uid),
    packUint32(salt),
    packUint32(expireTimestamp),
    serviceType,
    packedPrivileges
  );
}

export async function generateAgoraTokens(options: TokenOptions): Promise<AgoraTokenResult> {
  const { appId, appCertificate } = getAgoraCredentials();
  
  // CRITICAL: Calculate expiry correctly (current timestamp + duration)
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpire = currentTimestamp + expiresInSeconds;
  
  // Generate random salt
  const salt = Math.floor(Math.random() * 0xFFFFFFFF);

  console.log('[Native Deno Token Generation] Input:', {
    appId: appId.substring(0, 8) + '...',
    appCertificate: appCertificate.substring(0, 8) + '...',
    channelName: options.channelName,
    uid: options.uid,
    role: options.role,
    currentTimestamp,
    expiresInSeconds,
    privilegeExpire,
    salt,
  });

  // Build message to sign
  const message = buildMessage(
    appId,
    options.channelName,
    options.uid,
    salt,
    privilegeExpire
  );

  // Sign with HMAC-SHA256
  const signature = await hmacSign(appCertificate, message);

  // Build final token: '007' prefix + base64(signature + salt + expireTimestamp + message)
  // CRITICAL: AccessToken2 requires literal '007' prefix, NOT base64-encoded version bytes
  const payload = concatArrays(
    signature,
    packUint32(salt),
    packUint32(privilegeExpire),
    message
  );

  // Base64 encode payload and prepend '007'
  const rtcToken = '007' + btoa(String.fromCharCode(...payload));

  // Enhanced debug block
  console.log("=== AGORA TOKEN VERIFICATION ===");
  console.log("AppID:", appId);
  console.log("Cert8:", appCertificate.slice(0, 8));
  console.log("Channel:", options.channelName);
  console.log("UID:", options.uid);
  console.log("Token starts with 007:", rtcToken.startsWith("007")); // MUST be literal '007'
  console.log("Token length:", rtcToken.length);
  console.log("Token prefix:", rtcToken.slice(0, 20));
  console.log("ExpiresAt:", privilegeExpire);
  console.log("ExpiresAt ISO:", new Date(privilegeExpire * 1000).toISOString());
  console.log("================================");

  return {
    rtcToken,
    rtmToken: rtcToken, // Signaling uses the same token
    rtmUid: options.uid,
    expiresAt: privilegeExpire,
    appId,
  };
}
