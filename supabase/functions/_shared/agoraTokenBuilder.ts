/**
 * Agora AccessToken2 Builder for Deno
 * Implements token generation using Web Crypto API (no Node.js dependencies)
 */

// Service types
const SERVICE_RTC = 1;
const SERVICE_RTM = 2;

// Privilege types for RTC
const PRIVILEGE_JOIN_CHANNEL = 1;
const PRIVILEGE_PUBLISH_AUDIO_STREAM = 2;
const PRIVILEGE_PUBLISH_VIDEO_STREAM = 3;
const PRIVILEGE_PUBLISH_DATA_STREAM = 4;

// Role definitions
export enum Role {
  PUBLISHER = 1,
  SUBSCRIBER = 2,
}

/**
 * Convert role string to enum
 */
function parseRole(role: string): Role {
  return role.toLowerCase() === "publisher" ? Role.PUBLISHER : Role.SUBSCRIBER;
}

/**
 * Generate random salt (4 bytes)
 */
function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(4));
}

/**
 * CRC32 calculation for checksum
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  return ~crc >>> 0;
}

/**
 * Pack uint16 as little-endian bytes
 */
function packUint16LE(value: number): Uint8Array {
  const buffer = new Uint8Array(2);
  buffer[0] = value & 0xFF;
  buffer[1] = (value >>> 8) & 0xFF;
  return buffer;
}

/**
 * Pack uint32 as little-endian bytes
 */
function packUint32LE(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = value & 0xFF;
  buffer[1] = (value >>> 8) & 0xFF;
  buffer[2] = (value >>> 16) & 0xFF;
  buffer[3] = (value >>> 24) & 0xFF;
  return buffer;
}

/**
 * Pack string with uint16 length prefix
 */
function packString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(str);
  const length = packUint16LE(strBytes.length);
  const result = new Uint8Array(length.length + strBytes.length);
  result.set(length, 0);
  result.set(strBytes, length.length);
  return result;
}

/**
 * Pack map with uint16 count prefix
 */
function packMap(map: Record<number, number>): Uint8Array {
  const entries = Object.entries(map);
  const count = packUint16LE(entries.length);
  
  const parts: Uint8Array[] = [count];
  for (const [key, value] of entries) {
    parts.push(packUint16LE(Number(key)));
    parts.push(packUint32LE(value));
  }
  
  const totalLength = parts.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

/**
 * Concatenate multiple Uint8Arrays
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * HMAC-SHA256 signature using Web Crypto API
 */
async function hmacSign(message: Uint8Array, secret: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, message);
  return new Uint8Array(signature);
}

/**
 * Build service data for RTC
 */
function buildRtcService(
  channelName: string,
  uid: string,
  privileges: Record<number, number>
): Uint8Array {
  const serviceType = packUint16LE(SERVICE_RTC);
  const channelNameBytes = packString(channelName);
  const uidBytes = packString(uid);
  const privilegesBytes = packMap(privileges);
  
  return concat(serviceType, channelNameBytes, uidBytes, privilegesBytes);
}

/**
 * Build service data for RTM
 */
function buildRtmService(uid: string, privileges: Record<number, number>): Uint8Array {
  const serviceType = packUint16LE(SERVICE_RTM);
  const uidBytes = packString(uid);
  const privilegesBytes = packMap(privileges);
  
  return concat(serviceType, uidBytes, privilegesBytes);
}

/**
 * Build RTC token (AccessToken2 format)
 */
export async function buildRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string,
  role: Role | string,
  expireTimestamp: number
): Promise<string> {
  // Parse role if string
  const tokenRole = typeof role === "string" ? parseRole(role) : role;
  
  // Validate inputs
  if (!appId || !appCertificate) {
    throw new Error("App ID and App Certificate are required");
  }
  if (!channelName || channelName.length > 64) {
    throw new Error("Invalid channel name (max 64 chars)");
  }
  if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid) || uid.length > 255) {
    throw new Error("Invalid UID format (alphanumeric, max 255 chars)");
  }

  // Generate salt and timestamp
  const salt = generateSalt();
  const timestamp = Math.floor(Date.now() / 1000);

  // Build privileges based on role
  const privileges: Record<number, number> = {
    [PRIVILEGE_JOIN_CHANNEL]: expireTimestamp,
  };
  
  if (tokenRole === Role.PUBLISHER) {
    privileges[PRIVILEGE_PUBLISH_AUDIO_STREAM] = expireTimestamp;
    privileges[PRIVILEGE_PUBLISH_VIDEO_STREAM] = expireTimestamp;
    privileges[PRIVILEGE_PUBLISH_DATA_STREAM] = expireTimestamp;
  }

  // Build message for signing (NO expire in main message - only in privileges!)
  const serviceCount = packUint16LE(1); // Only 1 RTC service
  const serviceData = buildRtcService(channelName, uid, privileges);
  const message = concat(
    salt,
    packUint32LE(timestamp),
    serviceCount,
    serviceData
  );

  // Calculate CRC32 checksum
  const crc = crc32(message);
  const crcBytes = packUint32LE(crc);

  // Build content to sign: AppID + CRC + Message (in that order)
  const encoder = new TextEncoder();
  const contentAfterSignature = concat(crcBytes, message);
  const signingContent = concat(
    encoder.encode(appId),
    contentAfterSignature
  );

  // Generate HMAC-SHA256 signature
  const signature = await hmacSign(signingContent, appCertificate);

  // Final token structure: signature + crc + message
  const tokenData = concat(signature, crcBytes, message);

  // Base64 encode and prefix with version
  const base64Token = btoa(String.fromCharCode(...tokenData));
  return `007${base64Token}`;
}

/**
 * Build RTM token (AccessToken2 format)
 */
export async function buildRtmToken(
  appId: string,
  appCertificate: string,
  uid: string,
  expireTimestamp: number
): Promise<string> {
  // Validate inputs
  if (!appId || !appCertificate) {
    throw new Error("App ID and App Certificate are required");
  }
  if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid) || uid.length > 255) {
    throw new Error("Invalid UID format (alphanumeric, max 255 chars)");
  }

  // Generate salt and timestamp
  const salt = generateSalt();
  const timestamp = Math.floor(Date.now() / 1000);

  // RTM privileges
  const privileges: Record<number, number> = {
    [PRIVILEGE_JOIN_CHANNEL]: expireTimestamp,
  };

  // Build message for signing (NO expire in main message - only in privileges!)
  const serviceCount = packUint16LE(1); // Only 1 RTM service
  const serviceData = buildRtmService(uid, privileges);
  const message = concat(
    salt,
    packUint32LE(timestamp),
    serviceCount,
    serviceData
  );

  // Calculate CRC32 checksum
  const crc = crc32(message);
  const crcBytes = packUint32LE(crc);

  // Build content to sign: AppID + CRC + Message (in that order)
  const encoder = new TextEncoder();
  const contentAfterSignature = concat(crcBytes, message);
  const signingContent = concat(
    encoder.encode(appId),
    contentAfterSignature
  );

  // Generate HMAC-SHA256 signature
  const signature = await hmacSign(signingContent, appCertificate);

  // Final token structure: signature + crc + message
  const tokenData = concat(signature, crcBytes, message);

  // Base64 encode and prefix with version
  const base64Token = btoa(String.fromCharCode(...tokenData));
  return `007${base64Token}`;
}

/**
 * Verify token signature (for testing)
 */
export async function verifyTokenSignature(
  token: string,
  appId: string,
  appCertificate: string
): Promise<boolean> {
  try {
    if (!token.startsWith("007")) {
      return false;
    }

    // Decode base64 token
    const base64Data = token.slice(3);
    const binaryString = atob(base64Data);
    const tokenData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      tokenData[i] = binaryString.charCodeAt(i);
    }

    // Extract signature (first 32 bytes) and remaining data
    const signature = tokenData.slice(0, 32);
    const remaining = tokenData.slice(32);

    // Reconstruct signing content
    const encoder = new TextEncoder();
    const signingContent = concat(encoder.encode(appId), remaining);

    // Verify signature
    const expectedSignature = await hmacSign(signingContent, appCertificate);
    
    // Compare signatures
    if (signature.length !== expectedSignature.length) {
      return false;
    }
    for (let i = 0; i < signature.length; i++) {
      if (signature[i] !== expectedSignature[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error("[Agora Token] Verification error:", error);
    return false;
  }
}
