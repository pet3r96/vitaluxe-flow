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
  const clientRef = useRef<any>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const initRTM = async () => {
      try {
        const client = createRTMClient(appId);
        clientRef.current = client;

        await client.login({ uid: rtmUid, token: rtmToken });
        const channel = client.createChannel(channelName);
        channelRef.current = channel;

        await channel.join();
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

  return { messages, sendMessage, isConnected };
};
