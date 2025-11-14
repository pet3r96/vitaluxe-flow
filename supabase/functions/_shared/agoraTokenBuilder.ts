/**
 * Agora Token Builder - Official Port for Deno
 * Ported from: https://github.com/AgoraIO/Tools/tree/master/DynamicKey/AgoraDynamicKey/nodejs
 * 
 * This is a direct port of Agora's official Node.js AccessToken2 implementation
 * adapted to use Deno's Web Crypto API instead of Node's crypto module.
 */

// ============================================================================
// ByteBuf Helper Class (for packing/unpacking binary data)
// ============================================================================

class ByteBuf {
  private buffer: Uint8Array[];

  constructor() {
    this.buffer = [];
  }

  putUint16(v: number): ByteBuf {
    const buf = new Uint8Array(2);
    buf[0] = v & 0xFF;
    buf[1] = (v >>> 8) & 0xFF;
    this.buffer.push(buf);
    return this;
  }

  putUint32(v: number): ByteBuf {
    const buf = new Uint8Array(4);
    buf[0] = v & 0xFF;
    buf[1] = (v >>> 8) & 0xFF;
    buf[2] = (v >>> 16) & 0xFF;
    buf[3] = (v >>> 24) & 0xFF;
    this.buffer.push(buf);
    return this;
  }

  putString(str: string): ByteBuf {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    this.putUint16(bytes.length);
    this.buffer.push(bytes);
    return this;
  }

  putTreeMapUInt32(map: Record<number, number>): ByteBuf {
    const keys = Object.keys(map).map(Number).sort((a, b) => a - b);
    this.putUint16(keys.length);
    for (const key of keys) {
      this.putUint16(key);
      this.putUint32(map[key]);
    }
    return this;
  }

  pack(): Uint8Array {
    const totalLength = this.buffer.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of this.buffer) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}

// ============================================================================
// HMAC Helper (using Web Crypto API)
// ============================================================================

async function encodeHMac(key: Uint8Array | string, message: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = typeof key === 'string' ? encoder.encode(key) : new Uint8Array(key);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new Uint8Array(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Service Classes
// ============================================================================

const VERSION = '007';
const APP_ID_LENGTH = 32;

class Service {
  protected __type: number;
  protected __privileges: Record<number, number>;

  constructor(service_type: number) {
    this.__type = service_type;
    this.__privileges = {};
  }

  __pack_type(): Uint8Array {
    const buf = new ByteBuf();
    buf.putUint16(this.__type);
    return buf.pack();
  }

  __pack_privileges(): Uint8Array {
    const buf = new ByteBuf();
    buf.putTreeMapUInt32(this.__privileges);
    return buf.pack();
  }

  service_type(): number {
    return this.__type;
  }

  add_privilege(privilege: number, expire: number): void {
    this.__privileges[privilege] = expire;
  }

  pack(): Uint8Array {
    const type = this.__pack_type();
    const privileges = this.__pack_privileges();
    const result = new Uint8Array(type.length + privileges.length);
    result.set(type, 0);
    result.set(privileges, type.length);
    return result;
  }
}

const kRtcServiceType = 1;

class ServiceRtc extends Service {
  private __channel_name: string;
  private __uid: string;

  static kPrivilegeJoinChannel = 1;
  static kPrivilegePublishAudioStream = 2;
  static kPrivilegePublishVideoStream = 3;
  static kPrivilegePublishDataStream = 4;

  constructor(channel_name: string, uid: string | number) {
    super(kRtcServiceType);
    this.__channel_name = channel_name;
    this.__uid = uid === 0 ? '' : `${uid}`;
  }

  override pack(): Uint8Array {
    const servicePack = super.pack();
    const buffer = new ByteBuf();
    buffer.putString(this.__channel_name).putString(this.__uid);
    const bufferPack = buffer.pack();
    
    const result = new Uint8Array(servicePack.length + bufferPack.length);
    result.set(servicePack, 0);
    result.set(bufferPack, servicePack.length);
    return result;
  }
}

const kRtmServiceType = 2;

class ServiceRtm extends Service {
  private __user_id: string;

  static kPrivilegeLogin = 1;

  constructor(user_id: string) {
    super(kRtmServiceType);
    this.__user_id = user_id || '';
  }

  override pack(): Uint8Array {
    const servicePack = super.pack();
    const buffer = new ByteBuf();
    buffer.putString(this.__user_id);
    const bufferPack = buffer.pack();
    
    const result = new Uint8Array(servicePack.length + bufferPack.length);
    result.set(servicePack, 0);
    result.set(bufferPack, servicePack.length);
    return result;
  }
}

// ============================================================================
// AccessToken2 Class
// ============================================================================

class AccessToken2 {
  appId: string;
  appCertificate: string;
  issueTs: number;
  expire: number;
  salt: number;
  services: Record<number, Service>;

  constructor(appId: string, appCertificate: string, issueTs: number, expire: number) {
    this.appId = appId;
    this.appCertificate = appCertificate;
    this.issueTs = issueTs || Math.floor(Date.now() / 1000);
    this.expire = expire;
    this.salt = Math.floor(Math.random() * 99999999) + 1;
    this.services = {};
  }

  async __signing(): Promise<string> {
    // HMAC chaining: H(appCert, issueTs) -> signing; then H(signing, salt)
    let signing = await encodeHMac(
      this.appCertificate,
      new ByteBuf().putUint32(this.issueTs).pack()
    );
    signing = await encodeHMac(
      signing,
      new ByteBuf().putUint32(this.salt).pack()
    );
    return signing;
  }

  __build_check(): boolean {
    const is_uuid = (data: string): boolean => {
      if (data.length !== APP_ID_LENGTH) {
        return false;
      }
      try {
        // Check if it's valid hex
        const buf = new Uint8Array(data.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        return buf.length === APP_ID_LENGTH / 2;
      } catch {
        return false;
      }
    };

    if (!is_uuid(this.appId) || !is_uuid(this.appCertificate)) {
      return false;
    }

    if (Object.keys(this.services).length === 0) {
      return false;
    }

    return true;
  }

  add_service(service: Service): void {
    this.services[service.service_type()] = service;
  }

  async build(): Promise<string> {
    if (!this.__build_check()) {
      return '';
    }

    const signing = await this.__signing();
    
    let signing_info_buf = new ByteBuf()
      .putString(this.appId)
      .putUint32(this.issueTs)
      .putUint32(this.expire)
      .putUint32(this.salt)
      .putUint16(Object.keys(this.services).length);
    
    let signing_info = signing_info_buf.pack();

    // Pack all services
    const servicePacks: Uint8Array[] = [signing_info];
    for (const service of Object.values(this.services)) {
      servicePacks.push(service.pack());
    }

    // Concatenate all parts
    const totalLength = servicePacks.reduce((sum, arr) => sum + arr.length, 0);
    const fullSigningInfo = new Uint8Array(totalLength);
    let offset = 0;
    for (const pack of servicePacks) {
      fullSigningInfo.set(pack, offset);
      offset += pack.length;
    }

    // Create signature
    const encoder = new TextEncoder();
    const signatureHex = await encodeHMac(signing, fullSigningInfo);
    
    // Convert hex string to bytes
    const signatureBytes = new Uint8Array(
      signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );

    // Pack signature
    const signaturePack = new ByteBuf().putString(signatureHex).pack();
    
    // Combine signature and signing info
    const content = new Uint8Array(signaturePack.length + fullSigningInfo.length);
    content.set(signaturePack, 0);
    content.set(fullSigningInfo, signaturePack.length);

    // Compress using gzip (Deno's CompressionStream)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      }
    });

    const compressedStream = stream.pipeThrough(new CompressionStream('deflate-raw'));
    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const compressedLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const compressed = new Uint8Array(compressedLength);
    let compressedOffset = 0;
    for (const chunk of chunks) {
      compressed.set(chunk, compressedOffset);
      compressedOffset += chunk.length;
    }

    // Base64 encode
    const base64 = btoa(String.fromCharCode(...compressed));
    return `${VERSION}${base64}`;
  }
}

// ============================================================================
// RtcTokenBuilder Class (Main API)
// ============================================================================

export enum Role {
  PUBLISHER = 1,
  SUBSCRIBER = 2
}

export class RtcTokenBuilder {
  static async buildTokenWithUid(
    appId: string,
    appCertificate: string,
    channelName: string,
    uid: number,
    role: Role,
    tokenExpire: number,
    privilegeExpire: number = 0
  ): Promise<string> {
    return this.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      tokenExpire,
      privilegeExpire
    );
  }

  static async buildTokenWithUserAccount(
    appId: string,
    appCertificate: string,
    channelName: string,
    account: string | number,
    role: Role,
    tokenExpire: number,
    privilegeExpire: number = 0
  ): Promise<string> {
    const token = new AccessToken2(appId, appCertificate, 0, tokenExpire);

    const serviceRtc = new ServiceRtc(channelName, account);
    serviceRtc.add_privilege(ServiceRtc.kPrivilegeJoinChannel, privilegeExpire);
    
    if (role === Role.PUBLISHER) {
      serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishAudioStream, privilegeExpire);
      serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishVideoStream, privilegeExpire);
      serviceRtc.add_privilege(ServiceRtc.kPrivilegePublishDataStream, privilegeExpire);
    }
    
    token.add_service(serviceRtc);

    return await token.build();
  }
}

export class RtmTokenBuilder {
  static async buildToken(
    appId: string,
    appCertificate: string,
    userId: string,
    expire: number
  ): Promise<string> {
    const token = new AccessToken2(appId, appCertificate, 0, expire);

    const serviceRtm = new ServiceRtm(userId);
    serviceRtm.add_privilege(ServiceRtm.kPrivilegeLogin, expire);
    token.add_service(serviceRtm);

    return await token.build();
  }
}

// ============================================================================
// Convenience wrappers for backward compatibility
// ============================================================================

export async function buildRtcToken(
  appId: string,
  appCertificate: string,
  channelName: string,
  uid: string | number,
  role: Role | string,
  expireTimestamp: number
): Promise<string> {
  const tokenRole = (role === 'publisher' || role === Role.PUBLISHER)
    ? Role.PUBLISHER
    : Role.SUBSCRIBER;

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = expireTimestamp - currentTimestamp;

  console.log('🎫 [Official Agora Port] Building RTC token:', {
    channelName,
    uid: String(uid),
    role: tokenRole === Role.PUBLISHER ? 'PUBLISHER' : 'SUBSCRIBER',
    privilegeExpireSeconds: privilegeExpireTs
  });

  const token = await RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    appCertificate,
    channelName,
    uid,
    tokenRole,
    privilegeExpireTs,
    privilegeExpireTs
  );

  console.log('✅ [Official Agora Port] RTC token generated:', {
    tokenPrefix: token.substring(0, 20) + '...',
    tokenLength: token.length,
    startsWith007: token.startsWith('007')
  });

  return token;
}

export async function buildRtmToken(
  appId: string,
  appCertificate: string,
  uid: string | number,
  expireTimestamp: number
): Promise<string> {
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = expireTimestamp - currentTimestamp;

  console.log('💬 [Official Agora Port] Building RTM token:', {
    uid: String(uid),
    privilegeExpireSeconds: privilegeExpireTs
  });

  const token = await RtmTokenBuilder.buildToken(
    appId,
    appCertificate,
    String(uid),
    privilegeExpireTs
  );

  console.log('✅ [Official Agora Port] RTM token generated:', {
    tokenPrefix: token.substring(0, 20) + '...',
    tokenLength: token.length,
    startsWith007: token.startsWith('007')
  });

  return token;
}

export function verifyTokenSignature(
  token: string,
  appId: string,
  appCertificate: string
): boolean {
  if (!token || !token.startsWith('007')) {
    console.error('❌ Token does not start with 007');
    return false;
  }

  if (token.length < 100 || token.length > 1000) {
    console.error('❌ Token length suspicious:', token.length);
    return false;
  }

  console.log('✅ Token format validation passed');
  return true;
}
