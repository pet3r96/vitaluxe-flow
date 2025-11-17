import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

interface VideoErrorDetails {
  sessionId: string;
  errorCode?: string | number;
  errorMessage: string;
  errorName?: string;
  joinParams: {
    appIdSample: string;
    channelName: string;
    uid: string;
    tokenPreview: string;
    isProvider: boolean;
  };
}

export const useVideoErrorLogger = () => {
  const logVideoError = async (details: VideoErrorDetails) => {
    try {
      // Get browser info
      const browserInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
      };

      // Log to backend
      const { data, error } = await supabase.functions.invoke('log-video-error', {
        body: {
          sessionId: details.sessionId,
          errorCode: details.errorCode,
          errorMessage: details.errorMessage,
          errorName: details.errorName,
          joinParams: details.joinParams,
          browserInfo,
        }
      });

      if (error) {
        logger.error("Failed to log video error to backend", error);
      } else {
        logger.info("Video error logged to backend", { logId: data?.logId });
      }

      return data?.logId;
    } catch (err) {
      logger.error("Exception while logging video error", err);
      return null;
    }
  };

  return { logVideoError };
};
