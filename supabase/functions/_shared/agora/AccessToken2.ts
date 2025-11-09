// Official AccessToken2 implementation for Agora - Deno version
// Based on AgoraIO/Tools official Node.js implementation
import { createHmacSha256, base64Encode, crc32, packUint16, packUint32, concatUint8Arrays, compress } from './crypto.ts';

const VERSION = '007';
const VERSION_LENGTH = 3;
const APP_ID_LENGTH = 32;

// Convert Uint8Array to hex string  
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class AccessToken2 {
  private appId: string;
  private appCertificate: string;
  private issueTs: number;
  private expire: number;
  private salt: number;
  private services: any[];

  constructor(appId: string, appCertificate: string, expire: number) {
    this.appId = appId;
    this.appCertificate = appCertificate;
    this.issueTs = Math.floor(Date.now() / 1000);
    this.expire = expire;
    this.salt = Math.floor(Math.random() * 99999999) + 1;
    this.services = [];
  }

  addService(service: any): void {
    this.services.push(service);
  }

  private async buildSigningKey(): Promise<Uint8Array> {
    // Step 1: HMAC(issueTs, appCertificate) - official spec
    let signing = await createHmacSha256(this.appCertificate, packUint32(this.issueTs));
    // Step 2: HMAC(salt, result_from_step1)
    const signingHex = uint8ArrayToHex(signing);
    signing = await createHmacSha256(signingHex, packUint32(this.salt));
    return signing;
  }

  private buildSigningInfo(): Uint8Array {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Add AppId (string with length prefix)
    const appIdBytes = encoder.encode(this.appId);
    parts.push(packUint16(appIdBytes.length));
    parts.push(appIdBytes);

    // Add issueTs (uint32)
    parts.push(packUint32(this.issueTs));

    // Add expire (uint32)
    parts.push(packUint32(this.expire));

    // Add salt (uint32)
    parts.push(packUint32(this.salt));

    // Add services count (uint16)
    parts.push(packUint16(this.services.length));
    
    // Add each service pack
    for (const service of this.services) {
      const servicePacked = service.pack();
      parts.push(servicePacked);
    }

    return concatUint8Arrays(...parts);
  }

  async build(): Promise<string> {
    // Build the signing key according to official spec
    const signingKey = await this.buildSigningKey();
    const signingInfo = this.buildSigningInfo();
    
    // Sign the signing info with the derived signing key
    const signingKeyHex = uint8ArrayToHex(signingKey);
    const signature = await createHmacSha256(signingKeyHex, signingInfo);
    const signatureHex = uint8ArrayToHex(signature);

    // Build content: signature (as hex string with length prefix) + signing info
    const encoder = new TextEncoder();
    const signatureHexBytes = encoder.encode(signatureHex);
    
    const content = concatUint8Arrays(
      packUint16(signatureHexBytes.length),
      signatureHexBytes,
      signingInfo
    );

    // Compress using deflate-raw (zlib) and encode to base64
    const compressed = await compress(content);
    const encoded = base64Encode(compressed);
    
    return VERSION + encoded;
  }
}

export class Service {
  protected serviceType: number;

  constructor(serviceType: number) {
    this.serviceType = serviceType;
  }

  getServiceType(): number {
    return this.serviceType;
  }

  pack(): Uint8Array {
    return new Uint8Array(0);
  }

  protected packString(str: string): Uint8Array {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return concatUint8Arrays(packUint16(bytes.length), bytes);
  }

  protected packMapUint32(map: { [key: number]: number }): Uint8Array {
    const keys = Object.keys(map).map(k => parseInt(k)).sort((a, b) => a - b);
    const parts: Uint8Array[] = [packUint16(keys.length)];
    
    for (const key of keys) {
      parts.push(packUint16(key));
      parts.push(packUint32(map[key]));
    }
    
    return concatUint8Arrays(...parts);
  }
}
