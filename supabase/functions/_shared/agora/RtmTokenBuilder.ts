// RTM Token Builder for Agora - Deno implementation
import { AccessToken2, Service } from './AccessToken2.ts';
import { packUint16 } from './crypto.ts';

export enum RtmRole {
  Rtm_User = 1,
}

class ServiceRtm extends Service {
  private userId: string;
  private privileges: { [key: number]: number };

  static kServiceType = 2;
  static kPrivilegeLogin = 1;

  constructor(userId: string) {
    super(ServiceRtm.kServiceType);
    this.userId = userId;
    this.privileges = {};
  }

  addPrivilege(privilege: number, expireTs: number): void {
    this.privileges[privilege] = expireTs;
  }

  pack(): Uint8Array {
    const parts: Uint8Array[] = [];
    
    // CRITICAL: Pack service type FIRST (uint16) - matches Agora spec
    parts.push(packUint16(ServiceRtm.kServiceType));
    
    // Then pack privileges map
    parts.push(this.packMapUint32(this.privileges));
    
    // Finally pack userId string
    parts.push(this.packString(this.userId));
    
    return this.concatBytes(...parts);
  }

  private concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }
    return result;
  }
}

export class RtmTokenBuilder {
  static async buildToken(
    appId: string,
    appCertificate: string,
    userId: string,
    role: RtmRole,
    expireTs: number
  ): Promise<string> {
    const token = new AccessToken2(appId, appCertificate, expireTs);
    const serviceRtm = new ServiceRtm(userId);
    
    // Add login privilege for RTM
    serviceRtm.addPrivilege(ServiceRtm.kPrivilegeLogin, expireTs);
    
    token.addService(serviceRtm);
    return await token.build();
  }
}
