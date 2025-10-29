import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { Send } from "lucide-react";

interface MessageThreadProps {
  threadId: string;
}

export function MessageThread({ threadId }: MessageThreadProps) {
  const [message, setMessage] = useState("");

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

  const sendMutation = useMutation({
    mutationFn: async (messageText: string) => {
      const firstMsg = messages?.[0];
      if (!firstMsg) throw new Error("Thread not found");

      const { error } = await supabase.functions.invoke("send-patient-message", {
        body: {
          subject: firstMsg.subject || 'Re: Patient Message',
          message: messageText,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Message sent");
      setMessage("");
      refetch();
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

  return (
    <>
      <CardHeader>
        <CardTitle className="text-base">
          {firstMsg?.practice_id ? "Practice" : "Provider"} Conversation
        </CardTitle>
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
        </div>

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
      </CardContent>
    </>
  );
}
