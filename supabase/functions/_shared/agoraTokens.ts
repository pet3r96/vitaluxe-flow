// Official Agora token builder using esm.sh CDN (Deno-compatible)
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
  rtmToken: string; // Same as rtcToken for new Signaling system
  rtmUid: string;
  expiresAt: number;
  appId: string;
}

export async function generateAgoraTokens(options: TokenOptions): Promise<AgoraTokenResult> {
  const { appId, appCertificate } = getAgoraCredentials();

  const rtcRole = options.role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  
  // CRITICAL: Calculate expiry correctly (current timestamp + duration)
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpire = currentTimestamp + expiresInSeconds;

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

  // Generate token using OFFICIAL Agora library (NOT custom implementation)
  const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    appCertificate,
    options.channelName,
    options.uid,  // String UID
    rtcRole,
    privilegeExpire  // Single expiry parameter
  );

  console.log('[Official Agora Token Generated]:', {
    tokenLength: rtcToken.length,
    tokenPrefix: rtcToken.substring(0, 10),
    tokenVersion: rtcToken.startsWith('007') ? 'AccessToken2 (007)' : 'Unknown',
    channelName: options.channelName,
    uid: options.uid,
    expiresAt: privilegeExpire,
    expiresAtISO: new Date(privilegeExpire * 1000).toISOString(),
  });

  return {
    rtcToken,
    rtmToken: rtcToken, // Signaling uses the same token
    rtmUid: options.uid,
    expiresAt: privilegeExpire,
    appId,
  };
}
