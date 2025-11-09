// Local Agora token builders - no external dependencies
import { RtcTokenBuilder2, RtcRole } from './agora/RtcTokenBuilder2.ts';

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
  const expiresInSeconds = options.expiresInSeconds ?? 3600;
  const privilegeExpiredTs = Math.floor(Date.now() / 1000) + expiresInSeconds;

  console.log('[Agora Token Generation] Input:', {
    channelName: options.channelName,
    uid: options.uid,
    role: options.role,
    rtcRole,
    expiresInSeconds,
    privilegeExpiredTs,
    appId: appId.substring(0, 8) + '...',
  });

  // Build RTC token with user account
  // NOTE: In new Agora Signaling system, the SAME token is used for both RTC and Signaling/RTM
  const rtcToken = await RtcTokenBuilder2.buildTokenWithUserAccount(
    appId,
    appCertificate,
    options.channelName,
    String(options.uid), // Explicitly convert to string for consistency
    rtcRole,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  console.log('[Agora Token Generation] RTC Token (also used for Signaling/RTM):', rtcToken);

  // For new Signaling system: Use the SAME token for both RTC and RTM
  // The old separate RTM token builder is deprecated
  const rtmToken = rtcToken;

  const result = {
    rtcToken,
    rtmToken, // Same as rtcToken for new Signaling system
    rtmUid: options.uid,
    expiresAt: privilegeExpiredTs,
    appId,
  };

  console.log('[Agora Token Generation] Complete. Token length:', {
    tokenLength: rtcToken.length,
    note: 'Same token used for RTC and Signaling/RTM',
  });

  return result;
}
