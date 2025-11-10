// Deno-native Agora AccessToken2 implementation using Web Crypto API

const HEX_32_REGEX = /^[a-f0-9]{32}$/i;

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
  rtmToken: string;
  rtmUid: string;
  expiresAt: number;
  appId: string;
}

// Privilege types for AccessToken2
const kJoinChannel = 1;
const kPublishAudioStream = 2;
const kPublishVideoStream = 3;
const kPublishDataStream = 4;

async function generateAccessToken2(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  expireTimestamp: number,
  isPublisher: boolean
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint32Array(1))[0];
  
  // Build privileges
  const privileges: Record<number, number> = {
    [kJoinChannel]: expireTimestamp,
  };
  
  if (isPublisher) {
    privileges[kPublishAudioStream] = expireTimestamp;
    privileges[kPublishVideoStream] = expireTimestamp;
    privileges[kPublishDataStream] = expireTimestamp;
  }

  // Pack message
  const message = packMessage(appId, channelName, uid, salt, expireTimestamp, privileges);
  
  // Generate signature using HMAC-SHA256
  const signature = await hmacSign(appCertificate, message);
  
  // Build final payload: signature + message
  const payload = new Uint8Array(signature.length + message.length);
  payload.set(signature, 0);
  payload.set(message, signature.length);
  
  // Encode to base64
  const base64Payload = btoa(String.fromCharCode(...payload));
  
  // Final token: "007" + base64(payload)
  return "007" + base64Payload;
}

async function hmacSign(secret: string, message: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", key, message);
  return new Uint8Array(signature);
}

function packMessage(
  appId: string,
  channelName: string,
  uid: string,
  salt: number,
  expireTimestamp: number,
  privileges: Record<number, number>
): Uint8Array {
  const encoder = new TextEncoder();
  
  // Calculate size
  let size = 0;
  size += 4; // salt (uint32)
  size += 4; // expireTimestamp (uint32)
  size += 4; // privilege count (uint32)
  size += Object.keys(privileges).length * (2 + 4); // privilege entries (uint16 + uint32 each)
  size += 2 + encoder.encode(appId).length; // appId (uint16 length + bytes)
  size += 2 + encoder.encode(channelName).length; // channelName (uint16 length + bytes)
  size += 2 + encoder.encode(uid).length; // uid (uint16 length + bytes)
  
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);
  let offset = 0;
  
  // Write salt
  view.setUint32(offset, salt, true); // little-endian
  offset += 4;
  
  // Write expireTimestamp
  view.setUint32(offset, expireTimestamp, true);
  offset += 4;
  
  // Write privileges
  view.setUint32(offset, Object.keys(privileges).length, true);
  offset += 4;
  
  for (const [privilegeKey, privilegeExpire] of Object.entries(privileges)) {
    view.setUint16(offset, Number(privilegeKey), true);
    offset += 2;
    view.setUint32(offset, privilegeExpire, true);
    offset += 4;
  }
  
  // Write appId
  const appIdBytes = encoder.encode(appId);
  view.setUint16(offset, appIdBytes.length, true);
  offset += 2;
  buffer.set(appIdBytes, offset);
  offset += appIdBytes.length;
  
  // Write channelName
  const channelBytes = encoder.encode(channelName);
  view.setUint16(offset, channelBytes.length, true);
  offset += 2;
  buffer.set(channelBytes, offset);
  offset += channelBytes.length;
  
  // Write uid (as string)
  const uidBytes = encoder.encode(uid);
  view.setUint16(offset, uidBytes.length, true);
  offset += 2;
  buffer.set(uidBytes, offset);
  offset += uidBytes.length;
  
  return buffer;
}

export async function generateAgoraTokens(options: TokenOptions): Promise<AgoraTokenResult> {
  const { appId, appCertificate } = getAgoraCredentials();
  
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpire = currentTimestamp + expiresInSeconds;
  
  const isPublisher = options.role === 'publisher';

  console.log('[Deno-Native Agora Token Generation] Input:', {
    appId: appId.substring(0, 8) + '...',
    appCertificate: appCertificate.substring(0, 8) + '...',
    channelName: options.channelName,
    uid: options.uid,
    role: options.role,
    isPublisher,
    currentTimestamp,
    expiresInSeconds,
    privilegeExpire,
  });

  const rtcToken = await generateAccessToken2(
    appId,
    appCertificate,
    options.channelName,
    options.uid,
    privilegeExpire,
    isPublisher
  );

  // Verification
  console.log("=== AGORA TOKEN VERIFICATION (Deno-Native) ===");
  console.log("AppID:", appId);
  console.log("Cert8:", appCertificate.slice(0, 8));
  console.log("Channel:", options.channelName);
  console.log("UID:", options.uid);
  console.log("Token starts with 007:", rtcToken.startsWith("007"));
  console.log("Token length:", rtcToken.length);
  console.log("Token prefix (first 20 chars):", rtcToken.slice(0, 20));
  console.log("ExpiresAt:", privilegeExpire);
  console.log("ExpiresAt ISO:", new Date(privilegeExpire * 1000).toISOString());
  console.log("===================================================");

  return {
    rtcToken,
    rtmToken: rtcToken, // RTM/Signaling uses the same token
    rtmUid: options.uid,
    expiresAt: privilegeExpire,
    appId,
  };
}
