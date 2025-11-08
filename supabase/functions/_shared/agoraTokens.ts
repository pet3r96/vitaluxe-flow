// Local Agora token builders - no external dependencies
import { RtcTokenBuilder2, RtcRole } from './agora/RtcTokenBuilder2.ts';
import { RtmTokenBuilder, RtmRole } from './agora/RtmTokenBuilder.ts';

const HEX_32_REGEX = /^[a-f0-9]{32}$/i;

export interface AgoraCredentials {
  appId: string;
  appCertificate: string;
}

export function getAgoraCredentials(): AgoraCredentials {
  const rawAppId = Deno.env.get('AGORA_APP_ID');
  const rawAppCertificate = Deno.env.get('AGORA_APP_CERTIFICATE');

  if (!rawAppId || !rawAppCertificate) {
    throw new Error('Missing Agora credentials');
  }

  const appId = rawAppId.trim();
  const appCertificate = rawAppCertificate.trim();

  if (!HEX_32_REGEX.test(appId) || !HEX_32_REGEX.test(appCertificate)) {
    throw new Error('Invalid Agora credential format');
  }

  return { appId, appCertificate };
}

export interface TokenOptions {
  channelName: string;
  uid: string;
  role: 'publisher' | 'subscriber';
  expiresInSeconds?: number;
}

export interface AgoraTokenResult {
  rtcToken: string;
  rtmToken: string;
  rtmUid: string;
  expiresAt: number;
  appId: string;
}

export async function generateAgoraTokens(options: TokenOptions): Promise<AgoraTokenResult> {
  const { appId, appCertificate } = getAgoraCredentials();

  const rtcRole = options.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expiresInSeconds;

  // Build RTC token with user account
  const rtcToken = RtcTokenBuilder2.buildTokenWithUserAccount(
    appId,
    appCertificate,
    options.channelName,
    options.uid,
    rtcRole,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  // Build RTM token
  const rtmToken = RtmTokenBuilder.buildToken(
    appId,
    appCertificate,
    options.uid,
    RtmRole.Rtm_User,
    privilegeExpiredTs
  );

  return {
    rtcToken,
    rtmToken,
    rtmUid: options.uid,
    expiresAt: privilegeExpiredTs,
    appId,
  };
}
