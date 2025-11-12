// 🧹 TODO AGORA REFACTOR
import { useState, useEffect } from "react";
// import { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";

export interface NetworkQualityStats {
  uplinkQuality: number;
  downlinkQuality: number;
}

export const useNetworkQuality = (
  client: any | null, // IAgoraRTCClient | null,
  sessionId: string | null
) => {
  const [quality, setQuality] = useState<NetworkQualityStats>({
    uplinkQuality: 0,
    downlinkQuality: 0,
  });

  useEffect(() => {
    if (!client) return;

    const handleNetworkQuality = (stats: {
      uplinkNetworkQuality: number;
      downlinkNetworkQuality: number;
    }) => {
      setQuality({
        uplinkQuality: stats.uplinkNetworkQuality,
        downlinkQuality: stats.downlinkNetworkQuality,
      });
    };

    // client.on("network-quality", handleNetworkQuality);

    // Log quality metrics every 30 seconds
    const logInterval = setInterval(async () => {
      if (sessionId && (quality.uplinkQuality > 0 || quality.downlinkQuality > 0)) {
        try {
          await supabase
            .from("video_sessions")
            .update({
              connection_quality: {
                uplink: quality.uplinkQuality,
                downlink: quality.downlinkQuality,
                timestamp: new Date().toISOString(),
              },
            })
            .eq("id", sessionId);
        } catch (error) {
          console.error("Failed to log quality metrics:", error);
        }
      }
    }, 30000);

    return () => {
      // client.off("network-quality", handleNetworkQuality);
      clearInterval(logInterval);
    };
  }, [client, sessionId, quality]);

  return quality;
};
