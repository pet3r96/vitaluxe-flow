import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Send, CheckCircle2, RotateCcw } from "lucide-react";
import { MarkCompleteDialog } from "./MarkCompleteDialog";

interface MessageThreadProps {
  threadId: string;
  onThreadUpdate?: () => void;
}

export function MessageThread({ threadId, onThreadUpdate }: MessageThreadProps) {
  const [message, setMessage] = useState("");
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const { data: messages, refetch } = useQuery({
    queryKey: ["message-thread", threadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_messages")
        .select("*")
        .or(`id.eq.${threadId},thread_id.eq.${threadId}`)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Real-time subscription for instant thread updates
  useEffect(() => {
    const channel = supabase
      .channel('message-thread-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_messages',
          filter: `thread_id=eq.${threadId}`
        },
        (payload) => {
          console.log('Thread real-time update:', payload);
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, refetch]);

  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const firstMsg = messages?.[0];
      if (!firstMsg) throw new Error("Thread not found");

      const { error } = await supabase.functions.invoke("send-patient-message", {
        body: {
          message: messageText,
          subject: firstMsg.subject,
          thread_id: threadId,
          parent_message_id: firstMsg.id,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent");
      setMessage("");
      refetch();
      onThreadUpdate?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (notes?: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update all messages in this thread
      const { error } = await supabase
        .from("patient_messages")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: notes,
        })
        .or(`id.eq.${threadId},thread_id.eq.${threadId}`);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conversation marked as complete");
      refetch();
      onThreadUpdate?.();
      setShowCompleteDialog(false);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const reopenMutation = useMutation({
    mutationFn: async () => {
      // Update all messages in this thread
      const { error } = await supabase
        .from("patient_messages")
        .update({
          resolved: false,
          resolved_at: null,
          resolved_by: null,
          resolution_notes: null,
        })
        .or(`id.eq.${threadId},thread_id.eq.${threadId}`);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Conversation reopened");
      refetch();
      onThreadUpdate?.();
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  const firstMsg = messages?.[0];
  const isResolved = firstMsg?.resolved;

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">
              {firstMsg?.practice_id ? "Practice" : "Provider"} Conversation
            </CardTitle>
            {firstMsg?.urgency === 'urgent' && (
              <Badge variant="destructive" className="text-xs">Urgent</Badge>
            )}
            {isResolved && (
              <Badge variant="secondary" className="text-xs">Resolved</Badge>
            )}
          </div>
          <div className="flex gap-2">
            {isResolved ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reopen
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCompleteDialog(true)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {messages?.map((msg: any) => (
            <div
              key={msg.id}
              className={`p-3 rounded-lg ${
                msg.sender_type === "patient"
                  ? "bg-primary text-primary-foreground ml-8"
                  : "bg-muted mr-8"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.message_body}</p>
              <p className="text-xs opacity-75 mt-1">
                {format(new Date(msg.created_at), "MMM dd, h:mm a")}
              </p>
            </div>
          ))}
          
          {isResolved && firstMsg?.resolution_notes && (
            <div className="p-3 rounded-lg bg-secondary/50 border-l-4 border-secondary">
              <p className="text-xs font-semibold mb-1">Resolution Notes:</p>
              <p className="text-sm">{firstMsg.resolution_notes}</p>
            </div>
          )}
        </div>

        {!isResolved && (
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || sendMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>

      <MarkCompleteDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        onConfirm={(notes) => markCompleteMutation.mutate(notes)}
        isLoading={markCompleteMutation.isPending}
      />
    </>
  );
}
