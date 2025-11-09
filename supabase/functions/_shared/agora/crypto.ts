// Official Agora token generation crypto utilities - based on AgoraIO/Tools implementation
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

export async function createHmacSha256(key: string, data: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  
  // Use Web Crypto API for HMAC-SHA256 (works in edge functions)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(signature);
}

export function base64Encode(data: Uint8Array): string {
  return encodeBase64(data);
}

// CRC32 using the standard polynomial (0xEDB88320) as per Agora specification
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Pack uint16 in little-endian format (matching official Agora implementation)
export function packUint16(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint16(0, value, true); // true = little-endian
  return new Uint8Array(buffer);
}

// Pack uint32 in little-endian format (matching official Agora implementation)
export function packUint32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  const view = new DataView(buffer);
  view.setUint32(0, value, true); // true = little-endian
  return new Uint8Array(buffer);
}

export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  
  return result;
}

// Compress data using deflate (zlib)
export async function compress(data: Uint8Array): Promise<Uint8Array> {
  const compressedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    }
  }).pipeThrough(new CompressionStream("deflate-raw"));
  
  const chunks: Uint8Array[] = [];
  const reader = compressedStream.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  return concatUint8Arrays(...chunks);
}
