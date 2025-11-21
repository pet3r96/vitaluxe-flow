import { useEffect, useRef, useCallback, useState } from "react";
import { IAgoraRTCClient } from "agora-rtc-sdk-ng";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";

interface UseTokenAutoRefreshProps {
  client: IAgoraRTCClient | null;
  sessionId: string;
  channelName: string;
  uid: string; // User ID for token generation
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
  uid,
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
    logger.info("Refreshing Agora tokens", {
      currentTime: new Date(refreshStartTime * 1000).toISOString(),
      tokenExpires: new Date(tokenExpiryRef.current * 1000).toISOString(),
      timeUntilExpiry: Math.round((tokenExpiryRef.current - refreshStartTime) / 60)
    });

    try {
      // Verify authentication before refreshing tokens
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        logger.error('No Supabase session available for token refresh');
        throw new Error("Authentication required for token refresh");
      }

      logger.info('Token refresh auth attached. User:', { userId: session.user.id });

      const { data, error } = await supabase.functions.invoke('agora-token', {
        headers: { 
          Authorization: `Bearer ${session.access_token}` 
        },
        body: { 
          channel: channelName,
          uid,
          role: 'publisher',
          ttl: 3600
        }
      });

      if (error) throw error;

      if (!data?.rtcToken || !data?.rtmToken) {
        throw new Error("Invalid token response");
      }

      logger.info("Backend token response (auto refresh)", { 
        rtcToken: data?.rtcToken, 
        rtmToken: data?.rtmToken,
        rtcTokenLength: data?.rtcToken?.length,
        rtmTokenLength: data?.rtmToken?.length,
        rtcTokenPrefix: data?.rtcToken?.substring(0, 20),
        rtmTokenPrefix: data?.rtmToken?.substring(0, 20)
      });

      // Renew RTC token
      await client.renewToken(data.rtcToken);
      logger.info("RTC token renewed successfully");

      // Notify RTM token refresh
      if (onRtmTokenRefresh && data.rtmToken) {
        onRtmTokenRefresh(data.rtmToken);
        logger.info("RTM token renewal initiated");
      }

      // Update expiry time and refresh count
      const newExpiryTime = data.expiresAt || (Date.now() / 1000 + 3600);
      tokenExpiryRef.current = newExpiryTime;
      refreshCountRef.current += 1;
      
      const currentTime = Date.now() / 1000;
      
      logger.info("Token Refresh Complete", {
        refreshCount: refreshCountRef.current,
        newTokenExpires: new Date(newExpiryTime * 1000).toISOString(),
        validFor: Math.round((newExpiryTime - currentTime) / 60)
      });

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
      logger.error("Token refresh failed", error);
      setStatus(prev => ({ ...prev, isRefreshing: false }));
      
      toast({
        title: "Connection Warning",
        description: "Session token refresh failed. You may be disconnected soon.",
        variant: "destructive"
      });
    } finally {
      isRefreshingRef.current = false;
    }
  }, [client, channelName, uid, enabled, onRtmTokenRefresh, toast]);

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

    logger.info("Token Refresh Schedule", {
      currentTime: new Date(now * 1000).toISOString(),
      tokenExpires: new Date(tokenExpiryRef.current * 1000).toISOString(),
      nextRefresh: new Date(nextRefreshTime * 1000).toISOString(),
      timeUntilRefreshMinutes: Math.round(timeUntilRefresh / 60)
    });

    setStatus(prev => ({ ...prev, nextRefreshTime }));

    timerRef.current = setTimeout(() => {
      refreshTokens();
    }, timeUntilRefresh * 1000);
  }, [enabled, refreshTokens]);

  // Initialize token refresh scheduling
  useEffect(() => {
    if (!client || !enabled) return;

    logger.info("Token Auto-Refresh Initialized", {
      initialTokenExpiry: new Date(tokenExpiryRef.current * 1000).toISOString(),
      refreshBuffer: "5 minutes before expiry"
    });
    
    scheduleNextRefresh();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        logger.info("Token Auto-Refresh Cleanup");
      }
    };
  }, [client, enabled, scheduleNextRefresh]);

  return { 
    refreshTokens, 
    status,
    manualRefresh: refreshTokens,
  };
};
