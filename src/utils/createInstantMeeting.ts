import { supabase } from "@/integrations/supabase/client";
import { normalizeChannel } from "@/lib/video/normalizeChannel";

export interface InstantMeetingResult {
  channelId: string;
  tokenData: {
    rtcToken: string;
    rtmToken: string;
    expiresAt: number;
    uid: string;
  };
  joinUrlProvider: string;
  joinUrlPatient: string;
}

export async function createInstantMeeting(
  providerId: string
): Promise<InstantMeetingResult> {
  // Generate unique channel ID
  const channelId = normalizeChannel(`instant_${crypto.randomUUID()}`);
  
  logger.info('Creating instant meeting', { channelId, providerId });

  // Generate Agora tokens for the provider
  const { data: tokenData, error: tokenError } = await supabase.functions.invoke(
    'agora-token',
    {
      body: {
        channel: channelId,
        uid: providerId,
        role: 'publisher',
        ttl: 3600
      }
    }
  );

  if (tokenError || !tokenData) {
    logger.error('Token generation failed for instant meeting', tokenError, { channelId });
    throw new Error('Failed to generate Agora tokens');
  }

  logger.info('Agora tokens generated', {
    channelId,
    rtcTokenPreview: tokenData.rtcToken?.substring(0, 20) + '...',
    expiresAt: new Date(tokenData.expiresAt * 1000).toISOString()
  });

  // Construct join URLs
  const baseUrl = window.location.origin;
  const joinUrlProvider = `${baseUrl}/practice/video/${channelId}`;
  const joinUrlPatient = `${baseUrl}/patient/video/${channelId}`;

  logger.info('Instant meeting created successfully', {
    channelId,
    joinUrlProvider,
    joinUrlPatient
  });

  return {
    channelId,
    tokenData: {
      rtcToken: tokenData.rtcToken,
      rtmToken: tokenData.rtmToken,
      expiresAt: tokenData.expiresAt,
      uid: tokenData.uid
    },
    joinUrlProvider,
    joinUrlPatient
  };
}
