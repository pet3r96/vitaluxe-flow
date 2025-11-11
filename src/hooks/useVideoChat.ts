import { useState, useEffect, useRef } from "react";
import AgoraRTM from "agora-rtm-sdk";
import { supabase } from "@/integrations/supabase/client";
import { createRTMClient, decodeMessage } from "@/utils/agoraRTM";

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

        console.log("===== FE TOKEN DEBUG (RTM) =====");
        console.log("FE RTM Token (full):", rtmToken);
        console.log("RTM Token length:", rtmToken?.length);
        console.log("RTM Token prefix:", rtmToken?.substring(0, 20));
        console.log("RTM Login Params:", { appId, rtmUid });
        console.log("================================");

        try {
          await client.login({ uid: rtmUid, token: rtmToken });
          console.log('✅ [RTM] Successfully logged in');
          // Clear any previous errors on successful login
          setRtmErrorCode(null);
          setRtmErrorMessage(null);
        } catch (err: any) {
          console.error("=== AGORA RTM LOGIN ERROR ===", err);
          console.error("Error Code:", err.code);
          console.error("Error Name:", err.name);
          console.error("Error Message:", err.message);
          console.error("Full Error Object:", err);
          console.error("Error Stack:", err.stack);
          console.error("Parameters Used:", {
            appId,
            rtmUid,
            rtmTokenPrefix: rtmToken.substring(0, 20),
            rtmTokenLength: rtmToken.length,
          });
          console.error("============================");
          
          // Capture error for parent component
          setRtmErrorCode(err.code || null);
          setRtmErrorMessage(err.message || String(err));
          
          throw err;
        }

        const channel = client.createChannel(channelName);
        channelRef.current = channel;

        console.log('🔗 [RTM] Attempting to join channel:', channelName);
        try {
          await channel.join();
          console.log('✅ [RTM] Successfully joined channel');
        } catch (err: any) {
          console.error("=== AGORA RTM CHANNEL JOIN ERROR ===");
          console.error("Error Code:", err.code);
          console.error("Error Name:", err.name);
          console.error("Error Message:", err.message);
          console.error("Full Error Object:", err);
          console.error("====================================");
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
            const eventData = log.event_data as any;
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
        console.error("RTM initialization error:", error);
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
    if (!clientRef.current) return;
    
    try {
      await clientRef.current.renewToken(newToken);
      currentTokenRef.current = newToken;
      console.log("✅ RTM token renewed successfully");
    } catch (error) {
      console.error("❌ RTM token renewal failed:", error);
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
      console.error("Failed to send message:", error);
    }
  };

  return { messages, sendMessage, isConnected, renewRtmToken, rtmErrorCode, rtmErrorMessage };
};
