// Deno-compatible Agora token generation using Web Crypto API
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

// Helper function to convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Helper function to convert string to Uint8Array
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

// Base64 encoding compatible with Agora
function base64Encode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// HMAC-SHA256 using Web Crypto API
async function hmacSha256(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, message);
  return new Uint8Array(signature);
}

// Pack uint16 big-endian
function packUint16BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 8) & 0xff,
    value & 0xff
  ]);
}

// Pack uint32 big-endian
function packUint32BE(value: number): Uint8Array {
  return new Uint8Array([
    (value >> 24) & 0xff,
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff
  ]);
}

// Concatenate Uint8Arrays
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Generate RTC Token (AccessToken2)
async function buildRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  role: number,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const uidBytes = stringToBytes(uid);
  
  // Build message
  const message = concatBytes(
    stringToBytes(appId),
    packUint32BE(privilegeExpiredTs),
    packUint32BE(privilegeExpiredTs),
    stringToBytes(channelName),
    uidBytes
  );

  // Sign with HMAC-SHA256
  const key = hexToBytes(appCertificate);
  const signature = await hmacSha256(key, message);

  // Build token content
  const content = concatBytes(
    stringToBytes(version),
    packUint32BE(privilegeExpiredTs),
    packUint32BE(privilegeExpiredTs),
    packUint16BE(channelName.length),
    stringToBytes(channelName),
    packUint16BE(uidBytes.length),
    uidBytes,
    signature
  );

  return version + appId + base64Encode(content);
}

// Generate RTM Token
async function buildRtmToken(
  appId: string,
  appCertificate: string,
  uid: string,
  privilegeExpiredTs: number
): Promise<string> {
  const version = '007';
  const uidBytes = stringToBytes(uid);
  
  // Build message for RTM
  const message = concatBytes(
    stringToBytes(appId),
    stringToBytes(uid),
    packUint32BE(privilegeExpiredTs)
  );

  // Sign with HMAC-SHA256
  const key = hexToBytes(appCertificate);
  const signature = await hmacSha256(key, message);

  // Build token content
  const content = concatBytes(
    stringToBytes(version),
    packUint32BE(privilegeExpiredTs),
    packUint16BE(uidBytes.length),
    uidBytes,
    signature
  );

  return version + appId + base64Encode(content);
}

export async function generateAgoraTokens(options: TokenOptions): Promise<AgoraTokenResult> {
  const { appId, appCertificate } = getAgoraCredentials();

  const rtcRole = options.role === 'publisher' ? 1 : 2; // 1 = Publisher, 2 = Subscriber
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const rtcToken = await buildRtcToken(
    appId,
    appCertificate,
    options.channelName,
    options.uid,
    rtcRole,
    privilegeExpiredTs
  );

  const rtmToken = await buildRtmToken(
    appId,
    appCertificate,
    options.uid,
    privilegeExpiredTs
  );

  return {
    rtcToken,
    rtmToken,
    rtmUid: options.uid,
    expiresAt: privilegeExpiredTs,
    appId,
  };
}
