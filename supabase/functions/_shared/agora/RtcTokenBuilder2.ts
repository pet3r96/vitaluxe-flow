// RTC Token Builder for Agora - Deno implementation
import { AccessToken2, Service } from './AccessToken2.ts';
import { packUint16, packUint32, concatUint8Arrays } from './crypto.ts';

export enum RtcRole {
  PUBLISHER = 1,
  SUBSCRIBER = 2,
}

class ServiceRtc extends Service {
  private channelName: string;
  private uid: string;
  private privileges: { [key: number]: number };

  static kServiceType = 1;
  static kPrivilegeJoinChannel = 1;
  static kPrivilegePublishAudioStream = 2;
  static kPrivilegePublishVideoStream = 3;
  static kPrivilegePublishDataStream = 4;

  constructor(channelName: string, uid: string) {
    super(ServiceRtc.kServiceType);
    this.channelName = channelName;
    this.uid = uid;
    this.privileges = {};
  }

  addPrivilege(privilege: number, expireTs: number): void {
    this.privileges[privilege] = expireTs;
  }

  pack(): Uint8Array {
    const parts: Uint8Array[] = [];

    // Pack service type first (uint16)
    parts.push(packUint16(ServiceRtc.kServiceType));

    // Pack channel name (string with length prefix)
    parts.push(this.packString(this.channelName));

    // Pack UID (string with length prefix)
    parts.push(this.packString(this.uid));

    // Pack privileges map last using base class helper
    parts.push(this.packMapUint32(this.privileges));

    return concatUint8Arrays(...parts);
  }
}

export class RtcTokenBuilder2 {
  static async buildTokenWithUserAccount(
    appId: string,
    appCertificate: string,
    channelName: string,
    account: string,
    role: RtcRole,
    tokenExpire: number,
    privilegeExpire: number
  ): Promise<string> {
    const token = new AccessToken2(appId, appCertificate, tokenExpire);
    const serviceRtc = new ServiceRtc(channelName, account);

    serviceRtc.addPrivilege(ServiceRtc.kPrivilegeJoinChannel, privilegeExpire);

    if (role === RtcRole.PUBLISHER) {
      serviceRtc.addPrivilege(ServiceRtc.kPrivilegePublishAudioStream, privilegeExpire);
      serviceRtc.addPrivilege(ServiceRtc.kPrivilegePublishVideoStream, privilegeExpire);
      serviceRtc.addPrivilege(ServiceRtc.kPrivilegePublishDataStream, privilegeExpire);
    }

    token.addService(serviceRtc);
    return await token.build();
  }

  static async buildTokenWithUid(
    appId: string,
    appCertificate: string,
    channelName: string,
    uid: number,
    role: RtcRole,
    tokenExpire: number,
    privilegeExpire: number
  ): Promise<string> {
    return await this.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channelName,
      uid === 0 ? '' : String(uid),
      role,
      tokenExpire,
      privilegeExpire
    );
  }
}
