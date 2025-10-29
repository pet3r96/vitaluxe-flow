import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export function MessagesAndChatWidget() {
  const navigate = useNavigate();
  const { user, effectiveRole, effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread patient messages (support tickets)
  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-patient-messages", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0, subjects: [] };
      
      try {
        // First, get thread IDs where user is a participant
        const { data: participantThreads, error: participantError } = await supabase
          .from("thread_participants")
          .select("thread_id")
          .eq("user_id", user.id);

        if (participantError) throw participantError;
        
        const threadIds = participantThreads?.map(pt => pt.thread_id) || [];
        if (threadIds.length === 0) return { count: 0, subjects: [] };

        // Then get the threads with their latest messages
        const { data: threads, error: threadsError } = await supabase
          .from("message_threads")
          .select(`
            id,
            subject,
            messages!inner(created_at, sender_id)
          `)
          .in("id", threadIds)
          .order("created_at", { ascending: false })
          .limit(3);

        if (threadsError) throw threadsError;

        // Filter to only unread threads (where latest message is not from current user)
        const unreadThreads = threads?.filter((thread: any) => {
          const messages = Array.isArray(thread.messages) ? thread.messages : [thread.messages];
          const latestMessage = messages[0];
          return latestMessage?.sender_id !== user.id;
        }) || [];

        return {
          count: unreadThreads.length,
          subjects: unreadThreads.map((t: any) => t.subject).slice(0, 3)
        };
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        return { count: 0, subjects: [] };
      }
    },
    staleTime: 0,
  });

  // Fetch unread internal chat messages
  const { data: unreadInternalChat } = useQuery({
    queryKey: ["unread-internal-chat", user?.id, effectiveRole, effectivePracticeId],
    queryFn: async () => {
      if (!user?.id) return { count: 0, senders: [] };

      try {
        // Query practice-wide incomplete messages
        const { data: messages, error } = await supabase
          .from("internal_messages")
          .select("id, subject, created_by, completed")
          .eq("practice_id", effectivePracticeId)
          .eq("completed", false)
          .order("created_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        if (!messages || messages.length === 0) {
          return { count: 0, senders: [] };
        }

        // Get unique creator IDs
        const creatorIds = [...new Set(messages.map(m => m.created_by))];

        // Fetch creator names
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", creatorIds);

        // Map creator names to messages
        const creatorsMap = new Map(creators?.map(c => [c.id, c.name]) || []);
        const senders = messages.map(m => creatorsMap.get(m.created_by) || "Unknown");

        return {
          count: messages.length,
          senders: senders.slice(0, 3)
        };
      } catch (error) {
        console.error("Failed to fetch internal chat:", error);
        return { count: 0, senders: [] };
      }
    },
    staleTime: 0,
  });

  // Real-time subscriptions for instant updates
  useEffect(() => {
    if (!user?.id) return;

    const messagesChannel = supabase
      .channel('patient-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["unread-patient-messages", user.id] });
        }
      )
      .subscribe();

    const internalChannel = supabase
      .channel('internal-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        (payload) => {
          console.log("Internal messages change detected:", payload);
          queryClient.invalidateQueries({ queryKey: ["unread-internal-chat", user.id, effectiveRole, effectivePracticeId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(internalChannel);
    };
  }, [user?.id, effectivePracticeId, effectiveRole, queryClient]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Messages & Internal Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Patient Messages (Support Tickets) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Messages</h3>
            <Badge variant="secondary">{unreadMessages?.count || 0}</Badge>
          </div>
          {unreadMessages && unreadMessages.count > 0 ? (
            <div className="space-y-1.5">
              {unreadMessages.subjects.map((subject: string, idx: number) => (
                <div key={idx} className="text-sm text-muted-foreground truncate">
                  • {subject}
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => navigate("/messages")}
              >
                View All Messages
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No unread messages</p>
          )}
        </div>

        {/* Internal Chat */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Inbox className="h-4 w-4" />
              Internal Chat
            </h3>
            <Badge variant="secondary">{unreadInternalChat?.count || 0}</Badge>
          </div>
          {unreadInternalChat && unreadInternalChat.count > 0 ? (
            <div className="space-y-1.5">
              {unreadInternalChat.senders.map((sender: string, idx: number) => (
                <div key={idx} className="text-sm text-muted-foreground truncate">
                  • From {sender}
                </div>
              ))}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-2"
                onClick={() => navigate("/internal-chat")}
              >
                View Internal Chat
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No unread chat messages</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
