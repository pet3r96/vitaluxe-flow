import { useState, useEffect, useRef } from "react";
import AgoraRTM from "agora-rtm-sdk";
import { supabase } from "@/integrations/supabase/client";
import { createRTMClient, decodeMessage } from "@/utils/agoraRTM";
import { logger } from "@/lib/logger";

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: "user" | "system";
}

interface UseVideoChatProps {
  appId: string;
  rtmToken: string;
  rtmUid: string;
  channelName: string;
  sessionId: string;
  userName: string;
  userType: "provider" | "patient";
}

export const useVideoChat = ({
  appId,
  rtmToken,
  rtmUid,
  channelName,
  sessionId,
  userName,
  userType,
}: UseVideoChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [rtmErrorCode, setRtmErrorCode] = useState<string | number | null>(null);
  const [rtmErrorMessage, setRtmErrorMessage] = useState<string | null>(null);
  const clientRef = useRef<any>(null);
  const channelRef = useRef<any>(null);
  const currentTokenRef = useRef<string>(rtmToken);

  useEffect(() => {
    const initRTM = async () => {
      try {
        const client = createRTMClient(appId);
        clientRef.current = client;

        logger.info("RTM token debug", {
          rtmTokenLength: rtmToken?.length,
          rtmTokenPrefix: rtmToken?.substring(0, 20),
          appId,
          rtmUid
        });

        try {
          await client.login({ uid: rtmUid, token: rtmToken });
          logger.info("RTM logged in successfully");
          // Clear any previous errors on successful login
          setRtmErrorCode(null);
          setRtmErrorMessage(null);
        } catch (err: any) {
          logger.error("Agora RTM login failed", err, {
            errorCode: err.code,
            errorName: err.name,
            appId,
            rtmUid,
            rtmTokenLength: rtmToken.length
          });
          
          // Capture error for parent component
          setRtmErrorCode(err.code || null);
          setRtmErrorMessage(err.message || String(err));
          
          throw err;
        }

        const channel = client.createChannel(channelName);
        channelRef.current = channel;

        logger.info("RTM attempting to join channel", { channelName });
        try {
          await channel.join();
        logger.info("RTM joined channel successfully");
        
        // Monitor RTM connection errors
        client.on('ConnectionStateChanged', (newState, reason) => {
          logger.info("RTM connection state changed", { newState, reason });
          
          if (reason === 'TOKEN_EXPIRED') {
            logger.error("RTM token expired");
          }
          
          if (newState === 'ABORTED') {
            logger.error("RTM connection aborted", null, { reason });
          }
        });
      } catch (err: any) {
          logger.error("Agora RTM channel join failed", err, {
            errorCode: err.code,
            errorName: err.name
          });
          throw err;
        }
        
        setIsConnected(true);

        // Add system message for user joined
        const joinMessage: ChatMessage = {
          id: `system-${Date.now()}`,
          text: `${userName} joined the session`,
          senderId: "system",
          senderName: "System",
          timestamp: new Date(),
          type: "system",
        };
        setMessages((prev) => [...prev, joinMessage]);

        // Handle incoming messages
        channel.on("ChannelMessage", async (message: any, memberId: string) => {
          const text = decodeMessage(message.text);
          const newMessage: ChatMessage = {
            id: `${memberId}-${Date.now()}`,
            text,
            senderId: memberId,
            senderName: memberId === rtmUid ? userName : "Other User",
            timestamp: new Date(),
            type: "user",
          };
          setMessages((prev) => [...prev, newMessage]);

          // Store message in database
          await supabase.from("video_session_logs").insert({
            session_id: sessionId,
            event_type: "chat_message",
            user_type: userType,
            event_data: {
              message: text,
              sender_name: newMessage.senderName,
              timestamp: new Date().toISOString(),
            },
          });
        });

        // Load message history
        const { data: logs } = await supabase
          .from("video_session_logs")
          .select("*")
          .eq("session_id", sessionId)
          .eq("event_type", "chat_message")
          .order("created_at", { ascending: true });

        if (logs && logs.length > 0) {
          const historyMessages: ChatMessage[] = logs.map((log) => {
            const eventData = log.event_data as import('@/types/video').VideoEventData;
            return {
              id: log.id,
              text: eventData?.message || "",
              senderId: log.user_type || "unknown",
              senderName: eventData?.sender_name || "User",
              timestamp: new Date(log.created_at),
              type: "user" as const,
            };
          });
          setMessages((prev) => [...historyMessages, ...prev]);
        }
      } catch (error) {
        logger.error("RTM initialization failed", error);
      }
    };

    if (appId && rtmToken && rtmUid) {
      initRTM();
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.leave();
      }
      if (clientRef.current) {
        clientRef.current.logout();
      }
    };
  }, [appId, rtmToken, rtmUid, channelName, sessionId, userName, userType]);

  const renewRtmToken = async (newToken: string) => {
    if (!clientRef.current || !channelRef.current) return;
    
    try {
      console.log("🔄 [RTM Renewal] Starting logout/login cycle");
      
      // Step 1: Leave channel gracefully
      await channelRef.current.leave();
      console.log("✅ [RTM Renewal] Left channel");
      
      // Step 2: Logout from RTM client
      await clientRef.current.logout();
      console.log("✅ [RTM Renewal] Logged out");
      
      // Step 3: Login with new token
      await clientRef.current.login({ uid: rtmUid, token: newToken });
      console.log("✅ [RTM Renewal] Logged in with new token");
      
      // Step 4: Rejoin channel
      await channelRef.current.join();
      console.log("✅ [RTM Renewal] Rejoined channel");
      
      currentTokenRef.current = newToken;
      console.log("✅ [RTM Renewal] Complete - Chat operational");
      
    } catch (error) {
      console.error("❌ [RTM Renewal] Failed:", error);
      throw error; // Let parent handle
    }
  };

  const sendMessage = async (text: string) => {
    if (!channelRef.current || !text.trim()) return;

    try {
      await channelRef.current.sendMessage({ text: text.trim() });

      // Add message to local state
      const newMessage: ChatMessage = {
        id: `${rtmUid}-${Date.now()}`,
        text: text.trim(),
        senderId: rtmUid,
        senderName: userName,
        timestamp: new Date(),
        type: "user",
      };
      setMessages((prev) => [...prev, newMessage]);

      // Store in database
      await supabase.from("video_session_logs").insert({
        session_id: sessionId,
        event_type: "chat_message",
        user_type: userType,
        event_data: {
          message: text.trim(),
          sender_name: userName,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error("Failed to send RTM message", error);
    }
  };

  return { messages, sendMessage, isConnected, renewRtmToken, rtmErrorCode, rtmErrorMessage };
};
