import { useEffect, useRef, useCallback, useState } from "react";
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

interface TokenRefreshStatus {
  lastRefreshTime: number | null;
  nextRefreshTime: number | null;
  tokenExpiryTime: number | null;
  isRefreshing: boolean;
  refreshCount: number;
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
  const refreshCountRef = useRef(0);
  
  const [status, setStatus] = useState<TokenRefreshStatus>({
    lastRefreshTime: null,
    nextRefreshTime: null,
    tokenExpiryTime: initialTokenExpiry || Date.now() / 1000 + 3600,
    isRefreshing: false,
    refreshCount: 0,
  });

  const refreshTokens = useCallback(async () => {
    if (!client || !enabled || isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;
    setStatus(prev => ({ ...prev, isRefreshing: true }));
    
    const refreshStartTime = Date.now() / 1000;
    console.log("🔄 Refreshing Agora tokens...");
    console.log(`📊 Token Status Before Refresh:`);
    console.log(`   Current Time: ${new Date(refreshStartTime * 1000).toISOString()}`);
    console.log(`   Token Expires: ${new Date(tokenExpiryRef.current * 1000).toISOString()}`);
    console.log(`   Time Until Expiry: ${Math.round((tokenExpiryRef.current - refreshStartTime) / 60)} minutes`);

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

      // Update expiry time and refresh count
      const newExpiryTime = data.expiresAt || (Date.now() / 1000 + 3600);
      tokenExpiryRef.current = newExpiryTime;
      refreshCountRef.current += 1;
      
      const currentTime = Date.now() / 1000;
      
      console.log(`✅ Token Refresh Complete (#${refreshCountRef.current})`);
      console.log(`   New Token Expires: ${new Date(newExpiryTime * 1000).toISOString()}`);
      console.log(`   Valid For: ${Math.round((newExpiryTime - currentTime) / 60)} minutes`);

      setStatus({
        lastRefreshTime: currentTime,
        nextRefreshTime: null, // Will be set by scheduleNextRefresh
        tokenExpiryTime: newExpiryTime,
        isRefreshing: false,
        refreshCount: refreshCountRef.current,
      });

      // Schedule next refresh (5 minutes before expiry)
      scheduleNextRefresh();
      
      // Show success toast
      toast({
        title: "Session Extended",
        description: `Tokens refreshed successfully. Session extended by ${Math.round((newExpiryTime - currentTime) / 60)} minutes.`,
      });

    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      setStatus(prev => ({ ...prev, isRefreshing: false }));
      
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
    const nextRefreshTime = now + timeUntilRefresh;

    console.log(`⏰ Token Refresh Schedule:`);
    console.log(`   Current Time: ${new Date(now * 1000).toISOString()}`);
    console.log(`   Token Expires: ${new Date(tokenExpiryRef.current * 1000).toISOString()}`);
    console.log(`   Next Refresh: ${new Date(nextRefreshTime * 1000).toISOString()}`);
    console.log(`   Time Until Refresh: ${Math.round(timeUntilRefresh / 60)} minutes`);

    setStatus(prev => ({ ...prev, nextRefreshTime }));

    timerRef.current = setTimeout(() => {
      refreshTokens();
    }, timeUntilRefresh * 1000);
  }, [enabled, refreshTokens]);

  // Initialize token refresh scheduling
  useEffect(() => {
    if (!client || !enabled) return;

    console.log(`🎬 Token Auto-Refresh Initialized`);
    console.log(`   Initial Token Expiry: ${new Date(tokenExpiryRef.current * 1000).toISOString()}`);
    console.log(`   Refresh Buffer: 5 minutes before expiry`);
    
    scheduleNextRefresh();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        console.log(`🛑 Token Auto-Refresh Cleanup`);
      }
    };
  }, [client, enabled, scheduleNextRefresh]);

  return { 
    refreshTokens, 
    status,
    manualRefresh: refreshTokens,
  };
};
