// Deno-compatible Agora token generation using official Deno builders
import { RtcTokenBuilder as RtcTokenBuilder2, RtcRole } from 'https://raw.githubusercontent.com/AgoraIO/Tools/main/DynamicKey/AgoraDynamicKey/deno/src/RtcTokenBuilder2.ts';
import { RtmTokenBuilder, RtmRole } from 'https://raw.githubusercontent.com/AgoraIO/Tools/main/DynamicKey/AgoraDynamicKey/deno/src/RtmTokenBuilder.ts';

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

  // Use official Deno builders (compatible with Edge runtime)
  const rtcToken = await Promise.resolve(
    RtcTokenBuilder2.buildTokenWithUserAccount(
      appId,
      appCertificate,
      options.channelName,
      options.uid,
      rtcRole,
      privilegeExpiredTs,
      privilegeExpiredTs
    )
  );

  const rtmToken = await Promise.resolve(
    RtmTokenBuilder.buildToken(
      appId,
      appCertificate,
      options.uid,
      RtmRole.Rtm_User,
      privilegeExpiredTs
    )
  );

  return {
    rtcToken,
    rtmToken,
    rtmUid: options.uid,
    expiresAt: privilegeExpiredTs,
    appId,
  };
}
