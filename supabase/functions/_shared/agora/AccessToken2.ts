// Official AccessToken2 implementation for Agora - Deno version
// Based on AgoraIO/Tools official Node.js implementation
import { createHmacSha256, base64Encode, crc32, packUint16, packUint32, concatUint8Arrays, compress } from './crypto.ts';

const VERSION = '007';
const VERSION_LENGTH = 3;
const APP_ID_LENGTH = 32;

export class AccessToken2 {
  private appId: string;
  private appCertificate: string;
  private ts: number;
  private salt: number;
  private services: any[];

  constructor(appId: string, appCertificate: string, expire: number) {
    this.appId = appId;
    this.appCertificate = appCertificate;
    this.ts = expire; // Token expiration timestamp
    this.salt = Math.floor(Math.random() * 99999999) + 1;
    this.services = [];
  }

  addService(service: any): void {
    this.services.push(service);
  }

  private async buildMessage(): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];

    // Add AppId (string with length prefix)
    const appIdBytes = encoder.encode(this.appId);
    parts.push(packUint16(appIdBytes.length));
    parts.push(appIdBytes);

    // Add salt (uint32)
    parts.push(packUint32(this.salt));

    // Add ts (uint32)
    parts.push(packUint32(this.ts));

    // Add services count (uint16)
    parts.push(packUint16(this.services.length));
    
    // Add each service WITH service type prefix as required by spec
    for (const service of this.services) {
      // Service type
      const type = typeof service.getServiceType === 'function' ? service.getServiceType() : 0;
      parts.push(packUint16(type));

      const servicePacked = service.pack();
      parts.push(packUint16(servicePacked.length));
      parts.push(servicePacked);
    }

    const message = concatUint8Arrays(...parts);
    
    // Compress the message using deflate (zlib)
    return await compress(message);
  }

  private async sign(message: Uint8Array): Promise<Uint8Array> {
    return await createHmacSha256(this.appCertificate, message);
  }

  async build(): Promise<string> {
    const message = await this.buildMessage();
    const signature = await this.sign(message);

    // Build the packed content according to official spec:
    // signature_len(2) + signature + crc32(4) + ts(4) + compressed_message
    const parts: Uint8Array[] = [];
    
    // Add signature with length prefix
    parts.push(packUint16(signature.length));
    parts.push(signature);

    // Calculate and add CRC32 of the salt+ts+message
    const crcContent = concatUint8Arrays(
      packUint32(this.salt),
      packUint32(this.ts), 
      message
    );
    const crcValue = crc32(crcContent);
    parts.push(packUint32(crcValue));

    // Add timestamp
    parts.push(packUint32(this.ts));

    // Add compressed message
    parts.push(message);

    // Combine all parts and encode
    const content = concatUint8Arrays(...parts);
    const encoded = base64Encode(content);
    
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
