/**
 * Shared Agora Token Service
 * 
 * Provides a unified interface for generating RTC and RTM tokens
 * using Agora's AccessToken2 format with Web Crypto (Deno-compatible).
 */

import { buildRtcToken, buildRtmToken, Role } from "./agoraTokenBuilder.ts";

export type AgoraRole = 'publisher' | 'subscriber';

interface AgoraTokenResponse {
  rtcToken: string;
  rtmToken: string;
  expiresAt: number;
}

/**
 * Creates Agora RTC and RTM tokens with proper AccessToken2 format
 * 
 * @param channel - Channel name for RTC
 * @param uid - User ID (string or number)
 * @param role - 'publisher' (can publish) or 'subscriber' (view only)
 * @param expireSeconds - Token lifetime in seconds (default: 3600)
 * @returns Object with rtcToken, rtmToken, and expiresAt (UNIX seconds)
 * @throws Error if credentials are missing or token generation fails
 */
export async function createAgoraTokens(
  channel: string,
  uid: string | number,
  role: AgoraRole,
  expireSeconds = 3600
): Promise<AgoraTokenResponse> {
  // Validate inputs
  if (!channel || channel.trim() === '') {
    throw new Error('Channel name is required');
  }
  if (uid === undefined || uid === null || uid === '') {
    throw new Error('UID is required');
  }

  // Read Agora credentials from environment
  const appId = (Deno.env.get('AGORA_APP_ID') ?? '').trim();
  const appCert = (Deno.env.get('AGORA_APP_CERTIFICATE') ?? '').trim();

  if (!appId) {
    throw new Error('AGORA_APP_ID environment variable is not configured');
  }
  if (!appCert) {
    throw new Error('AGORA_APP_CERTIFICATE environment variable is not configured');
  }

  // Calculate expiry timestamp
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + Math.max(60, Math.min(expireSeconds, 86400)); // 1 min to 24 hours

  // Map role to Agora Role enum
  const agoraRole = role === 'publisher' ? Role.PUBLISHER : Role.SUBSCRIBER;

  try {
    // Generate RTC token
    const rtcToken = await buildRtcToken(
      appId,
      appCert,
      channel,
      String(uid),
      agoraRole,
      expiresAt
    );

    // Generate RTM token
    const rtmToken = await buildRtmToken(
      appId,
      appCert,
      String(uid),
      expiresAt
    );

    // Log token generation (prefix only for security)
    console.log('[AgoraTokenService] Tokens generated:', {
      channel,
      uid: String(uid),
      role,
      rtcTokenPrefix: rtcToken.substring(0, 12) + '...',
      rtmTokenPrefix: rtmToken.substring(0, 12) + '...',
      expiresAt,
      expiresIn: expiresAt - now
    });

    return {
      rtcToken,
      rtmToken,
      expiresAt
    };
  } catch (error) {
    console.error('[AgoraTokenService] Token generation failed:', {
      error: error instanceof Error ? error.message : String(error),
      channel,
      uid: String(uid),
      role
    });
    throw new Error(`Failed to generate Agora tokens: ${error instanceof Error ? error.message : String(error)}`);
  }
}
