import { useEffect, useRef, useCallback } from "react";
import { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseTokenAutoRefreshProps {
  client: IAgoraRTCClient | null;
  sessionId: string;
  channelName: string;
  initialTokenExpiry?: number; // Unix timestamp in seconds
  onRtmTokenRefresh?: (newToken: string) => void;
  enabled?: boolean;
}

export const useTokenAutoRefresh = ({
  client,
  sessionId,
  channelName,
  initialTokenExpiry,
  onRtmTokenRefresh,
  enabled = true,
}: UseTokenAutoRefreshProps) => {
  const { toast } = useToast();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const tokenExpiryRef = useRef<number>(initialTokenExpiry || Date.now() / 1000 + 3600);

  const refreshTokens = useCallback(async () => {
    if (!client || !enabled || isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    console.log("🔄 Refreshing Agora tokens...");

    try {
      const { data, error } = await supabase.functions.invoke('generate-agora-token', {
        body: { sessionId, role: 'publisher' }
      });

      if (error) throw error;

      if (!data?.rtcToken || !data?.rtmToken) {
        throw new Error("Invalid token response");
      }

      console.log("RAW BACKEND TOKEN RESPONSE (auto refresh):", data);
      console.log("===== FE TOKEN DEBUG (auto refresh) =====");
      console.log("FE RTC Token (full):", data?.rtcToken);
      console.log("FE RTM Token (full):", data?.rtmToken);
      console.log("RTC Token length:", data?.rtcToken?.length);
      console.log("RTM Token length:", data?.rtmToken?.length);
      console.log("RTC Token prefix:", data?.rtcToken?.substring(0, 20));
      console.log("RTM Token prefix:", data?.rtmToken?.substring(0, 20));
      console.log("================================");

      // Renew RTC token
      await client.renewToken(data.rtcToken);
      console.log("✅ RTC token renewed successfully");

      // Notify RTM token refresh
      if (onRtmTokenRefresh && data.rtmToken) {
        onRtmTokenRefresh(data.rtmToken);
        console.log("✅ RTM token renewal initiated");
      }

      // Update expiry time
      if (data.expiresAt) {
        tokenExpiryRef.current = data.expiresAt;
      } else {
        // Fallback: assume 1 hour from now
        tokenExpiryRef.current = Date.now() / 1000 + 3600;
      }

      // Schedule next refresh (5 minutes before expiry)
      scheduleNextRefresh();

    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      toast({
        title: "Connection Warning",
        description: "Session token refresh failed. You may be disconnected soon.",
        variant: "destructive"
      });
    } finally {
      isRefreshingRef.current = false;
    }
  }, [client, sessionId, enabled, onRtmTokenRefresh, toast]);

  const scheduleNextRefresh = useCallback(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!enabled) return;

    const now = Date.now() / 1000; // Current time in seconds
    const timeUntilExpiry = tokenExpiryRef.current - now;
    const refreshBuffer = 5 * 60; // 5 minutes before expiry
    const timeUntilRefresh = Math.max(0, timeUntilExpiry - refreshBuffer);

    console.log(`⏰ Next token refresh scheduled in ${Math.round(timeUntilRefresh / 60)} minutes`);

    timerRef.current = setTimeout(() => {
      refreshTokens();
    }, timeUntilRefresh * 1000);
  }, [enabled, refreshTokens]);

  // Initialize token refresh scheduling
  useEffect(() => {
    if (!client || !enabled) return;

    scheduleNextRefresh();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [client, enabled, scheduleNextRefresh]);

  return { refreshTokens };
};
