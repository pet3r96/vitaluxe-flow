import { supabase } from "@/integrations/supabase/client";

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
        console.error("Failed to log error to backend:", error);
      } else {
        console.log("✅ Error logged to backend with ID:", data?.logId);
      }

      return data?.logId;
    } catch (err) {
      console.error("Exception while logging video error:", err);
      return null;
    }
  };

  return { logVideoError };
};
