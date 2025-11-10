import { RtcTokenBuilder, RtcRole } from "https://esm.sh/agora-token@2.0.5";

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
  
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpire = currentTimestamp + expiresInSeconds;
  
  // Map role to Agora RtcRole
  const rtcRole = options.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  console.log('[Official Agora Token Generation] Input:', {
    appId: appId.substring(0, 8) + '...',
    appCertificate: appCertificate.substring(0, 8) + '...',
    channelName: options.channelName,
    uid: options.uid,
    role: options.role,
    rtcRole,
    currentTimestamp,
    expiresInSeconds,
    privilegeExpire,
  });

  // Use official library to build token
  const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    appCertificate,
    options.channelName,
    options.uid,
    rtcRole,
    privilegeExpire
  );

  // Critical verification
  console.log("=== AGORA TOKEN VERIFICATION (Official Library) ===");
  console.log("AppID:", appId);
  console.log("Cert8:", appCertificate.slice(0, 8));
  console.log("Channel:", options.channelName);
  console.log("UID:", options.uid);
  console.log("Token starts with 007:", rtcToken.startsWith("007"));
  console.log("Token length:", rtcToken.length);
  console.log("Token prefix (first 20 chars):", rtcToken.slice(0, 20));
  console.log("ExpiresAt:", privilegeExpire);
  console.log("ExpiresAt ISO:", new Date(privilegeExpire * 1000).toISOString());
  console.log("===================================================");

  return {
    rtcToken,
    rtmToken: rtcToken, // RTM/Signaling uses the same token
    rtmUid: options.uid,
    expiresAt: privilegeExpire,
    appId,
  };
}
