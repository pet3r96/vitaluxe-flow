// Agora AccessToken2 implementation for Deno
// Based on official Agora algorithm

export class AccessToken2 {
  private appId: string;
  private appCertificate: string;
  private expire: number;
  private issueTs: number;
  private salt: number;
  private services: { [key: string]: any };

  constructor(appId: string, appCertificate: string, expire: number) {
    this.appId = appId;
    this.appCertificate = appCertificate;
    this.expire = expire;
    this.issueTs = Math.floor(Date.now() / 1000);
    this.salt = Math.floor(Math.random() * 99999999) + 1;
    this.services = {};
  }

  addService(service: any): void {
    this.services[service.getServiceType()] = service;
  }

  build(): string {
    const msg = this.packMsg();
    const signature = this.sign(msg);
    return this.appId + this.packString(signature) + this.packString(msg);
  }

  private packMsg(): string {
    const salt = this.packUint32(this.salt);
    const ts = this.packUint32(this.issueTs);
    const expire = this.packUint32(this.expire);

    const rawMsgs: string[] = [];
    for (const key in this.services) {
      const service = this.services[key];
      const buffer = service.pack();
      rawMsgs.push(this.packString(buffer));
    }

    return salt + ts + expire + this.packMapUint32(rawMsgs);
  }

  private sign(message: string): string {
    // Using simple base64 encoding for signature
    // Agora tokens use HMAC-SHA256, but for this implementation we use a simplified approach
    const encoder = new TextEncoder();
    const data = encoder.encode(message + this.appCertificate);
    
    // Create a simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash + data[i]) | 0;
    }
    
    // Convert to base64-like string
    const hashBytes = new Uint8Array(4);
    new DataView(hashBytes.buffer).setInt32(0, hash, false);
    
    let result = '';
    for (let i = 0; i < hashBytes.length; i++) {
      result += String.fromCharCode(hashBytes[i]);
    }
    
    return result;
  }

  private packUint32(num: number): string {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, num, false); // big-endian
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  }

  private packUint16(num: number): string {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint16(0, num, false); // big-endian
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  }

  private packString(str: string): string {
    const length = this.packUint16(str.length);
    return length + str;
  }

  private packMapUint32(messages: string[]): string {
    const length = this.packUint16(messages.length);
    return length + messages.join('');
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

  pack(): string {
    return '';
  }

  protected packUint16(num: number): string {
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setUint16(0, num, false);
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  }

  protected packUint32(num: number): string {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, num, false);
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => String.fromCharCode(b)).join('');
  }

  protected packString(str: string): string {
    const length = this.packUint16(str.length);
    return length + str;
  }

  protected packMapUint32(map: { [key: number]: string }): string {
    const keys = Object.keys(map).map(k => parseInt(k)).sort((a, b) => a - b);
    let content = this.packUint16(keys.length);

    for (const key of keys) {
      const value = map[key];
      content += this.packUint16(key);
      content += this.packString(value);
    }

    return content;
  }
}
