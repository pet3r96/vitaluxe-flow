// Official Agora token generation crypto utilities - based on AgoraIO/Tools implementation
import { createHmac } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

export async function createHmacSha256(key: string, data: Uint8Array): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  
  const hmac = createHmac("sha256", keyData);
  hmac.update(data);
  
  return new Uint8Array(hmac.digest());
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

// Pack uint16 in big-endian format
export function packUint16(value: number): Uint8Array {
  const buffer = new Uint8Array(2);
  buffer[0] = (value >> 8) & 0xFF;
  buffer[1] = value & 0xFF;
  return buffer;
}

// Pack uint32 in big-endian format
export function packUint32(value: number): Uint8Array {
  const buffer = new Uint8Array(4);
  buffer[0] = (value >> 24) & 0xFF;
  buffer[1] = (value >> 16) & 0xFF;
  buffer[2] = (value >> 8) & 0xFF;
  buffer[3] = value & 0xFF;
  return buffer;
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
