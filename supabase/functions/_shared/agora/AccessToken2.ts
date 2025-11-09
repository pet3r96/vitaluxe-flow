// Agora AccessToken2 implementation for Deno
// Based on official Agora token generation algorithm
import { createHmacSha256, base64Encode, crc32, packUint16, packUint32, concatUint8Arrays } from './crypto.ts';

const VERSION = "007";

export class AccessToken2 {
  private appId: string;
  private appCertificate: string;
  private expire: number;
  private issueTs: number;
  private salt: number;
  private services: Map<number, any>;

  constructor(appId: string, appCertificate: string, expire: number) {
    this.appId = appId;
    this.appCertificate = appCertificate;
    this.expire = expire;
    this.issueTs = Math.floor(Date.now() / 1000);
    this.salt = Math.floor(Math.random() * 99999999) + 1;
    this.services = new Map();
  }

  addService(service: any): void {
    this.services.set(service.getServiceType(), service);
  }

  async build(): Promise<string> {
    const message = this.buildMessage();
    const signature = await this.sign(message);
    
    // Combine: signature + crc32 + message
    const crc32Value = crc32(concatUint8Arrays(signature, message));
    const crc32Bytes = packUint32(crc32Value);
    
    const content = concatUint8Arrays(signature, crc32Bytes, message);
    const encoded = base64Encode(content);
    
    return VERSION + encoded;
  }

  private buildMessage(): Uint8Array {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    
    // Add appId
    const appIdBytes = encoder.encode(this.appId);
    parts.push(packUint16(appIdBytes.length));
    parts.push(appIdBytes);
    
    // Add salt
    parts.push(packUint32(this.salt));
    
    // Add issue timestamp
    parts.push(packUint32(this.issueTs));
    
    // Add expire
    parts.push(packUint32(this.expire));
    
    // Add services
    parts.push(packUint16(this.services.size));
    
    for (const [serviceType, service] of this.services) {
      parts.push(packUint16(serviceType));
      const servicePack = service.pack();
      parts.push(packUint16(servicePack.length));
      parts.push(servicePack);
    }
    
    return concatUint8Arrays(...parts);
  }

  private async sign(message: Uint8Array): Promise<Uint8Array> {
    return await createHmacSha256(this.appCertificate, message);
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
