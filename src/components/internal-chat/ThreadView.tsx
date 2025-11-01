import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Reply } from "lucide-react";
import { format } from "date-fns";
import { PriorityBadge } from "./PriorityBadge";
import { MessageBubble } from "./MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ThreadViewProps {
  selectedMessage: any;
  replyText: string;
  setReplyText: (text: string) => void;
  sendReplyMutation: any;
}

export function ThreadView({ selectedMessage, replyText, setReplyText, sendReplyMutation }: ThreadViewProps) {
  const threadId = selectedMessage.thread_id || selectedMessage.id;

  // Fetch all messages in this thread
  const { data: threadMessages, isLoading } = useQuery({
    queryKey: ["thread-messages", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_messages")
        .select(`
          *,
          patient:patient_accounts(first_name, last_name, email),
          sender:profiles(name)
        `)
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!threadId,
  });

  if (isLoading) {
    return <div className="text-center text-muted-foreground py-8">Loading conversation...</div>;
  }

  const firstMessage = threadMessages?.[0];

  return (
    <div className="flex flex-col h-full">
      {/* Thread Header */}
      <div className="border-b pb-4 mb-4">
        <p className="font-medium mb-1">
          Conversation with: {selectedMessage.patient?.first_name}{" "}
          {selectedMessage.patient?.last_name}
        </p>
        {firstMessage?.subject && (
          <p className="font-medium text-sm">Subject: {firstMessage.subject}</p>
        )}
        {firstMessage?.urgency && (
          <div className="mt-2">
            <PriorityBadge priority={firstMessage.urgency as "high" | "low" | "medium" | "urgent"} />
          </div>
        )}
      </div>

      {/* Messages Thread */}
      <ScrollArea className="flex-1 pr-4 mb-4">
        <div className="space-y-4">
          {threadMessages?.map((msg: any) => {
            const isProvider = msg.sender_type === 'provider';
            const senderName = isProvider 
              ? (msg.sender?.name || 'Provider')
              : `${msg.patient?.first_name || ''} ${msg.patient?.last_name || ''}`.trim();

            return (
              <MessageBubble
                key={msg.id}
                message={{
                  id: msg.id,
                  body: msg.message_body,
                  created_at: msg.created_at,
                  sender: {
                    id: msg.sender_id,
                    name: senderName,
                  },
                }}
                isOwn={isProvider}
              />
            );
          })}
        </div>
      </ScrollArea>

      {/* Reply Section */}
      {!selectedMessage.resolved && (
        <div className="space-y-2 border-t pt-4">
          <Textarea
            placeholder="Type your reply..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
          />
          <Button
            onClick={() =>
              sendReplyMutation.mutate({
                patientId: selectedMessage.patient_id,
                body: replyText,
                threadId: threadId,
                subject: firstMessage?.subject,
              })
            }
            disabled={!replyText.trim() || sendReplyMutation.isPending}
          >
            <Reply className="mr-2 h-4 w-4" />
            Send Reply
          </Button>
        </div>
      )}
    </div>
  );
}
