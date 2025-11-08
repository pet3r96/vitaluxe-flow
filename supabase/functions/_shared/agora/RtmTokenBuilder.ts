// RTM Token Builder for Agora - Deno implementation
import { AccessToken2, Service } from './AccessToken2.ts';

export enum RtmRole {
  Rtm_User = 1,
}

class ServiceRtm extends Service {
  private userId: string;

  static kServiceType = 2;

  constructor(userId: string) {
    super(ServiceRtm.kServiceType);
    this.userId = userId;
  }

  pack(): string {
    return this.packString(this.userId);
  }
}

export class RtmTokenBuilder {
  static buildToken(
    appId: string,
    appCertificate: string,
    userId: string,
    role: RtmRole,
    expireTs: number
  ): string {
    const token = new AccessToken2(appId, appCertificate, expireTs);
    const serviceRtm = new ServiceRtm(userId);
    token.addService(serviceRtm);
    return token.build();
  }
}
