import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function MessagesAndChatWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch unread patient messages (support tickets)
  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-patient-messages", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0, subjects: [] };
      
      const { data, error } = await supabase
        .from("message_threads")
        .select(`
          id,
          subject,
          messages!inner(created_at, sender_id)
        `)
        .contains("participant_ids", [user.id])
        .order("messages(created_at)", { ascending: false })
        .limit(3);

      if (error) throw error;

      // Filter to only unread threads (where latest message is not from current user)
      const unreadThreads = data?.filter((thread: any) => {
        const messages = Array.isArray(thread.messages) ? thread.messages : [thread.messages];
        const latestMessage = messages[0];
        return latestMessage?.sender_id !== user.id;
      }) || [];

      return {
        count: unreadThreads.length,
        subjects: unreadThreads.map((t: any) => t.subject).slice(0, 3)
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch unread internal chat messages
  const { data: unreadInternalChat } = useQuery({
    queryKey: ["unread-internal-chat", user?.id],
    queryFn: async () => {
      if (!user?.id) return { count: 0, senders: [] };

      const { data, error } = await supabase
        .from("internal_messages")
        .select("id, subject, sender:profiles!internal_messages_sender_id_fkey(name)")
        .contains("recipient_ids", [user.id])
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      return {
        count: data?.length || 0,
        senders: data?.map((m: any) => m.sender?.name || "Unknown").slice(0, 3) || []
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

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
