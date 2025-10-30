import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MailOpen, Reply } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function PatientInbox() {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const { data: messages } = useQuery({
    queryKey: ["patient-messages-inbox"],
    queryFn: async () => {
      // Get current user's practice
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Try to get practice_id from providers table first
      const { data: providerData } = await supabase
        .from("providers")
        .select("practice_id")
        .eq("user_id", user.id)
        .maybeSingle();

      let practiceId = providerData?.practice_id;

      // If not a provider, try practice_staff table
      if (!practiceId) {
        const { data: staffData } = await supabase
          .from("practice_staff")
          .select("practice_id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        practiceId = staffData?.practice_id;
      }

      if (!practiceId) throw new Error("Practice not found");

      const { data, error } = await supabase
        .from("patient_messages")
        .select(`
          *,
          patient:patient_accounts(first_name, last_name, email)
        `)
        .eq("practice_id", practiceId)
        .eq("sender_type", "patient")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("patient_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-messages-inbox"] });
    },
  });

  const sendReplyMutation = useMutation({
    mutationFn: async ({ patientId, body }: { patientId: string; body: string }) => {
      const { error } = await supabase.functions.invoke("send-patient-message", {
        body: { patient_id: patientId, message_body: body, sender_type: "provider" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-messages-inbox"] });
      toast.success("Reply sent");
      setReplyText("");
      setSelectedMessage(null);
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const handleSelectMessage = (message: any) => {
    setSelectedMessage(message);
    if (!message.read_at) {
      markReadMutation.mutate(message.id);
    }
  };

  const unreadCount = messages?.filter((m) => !m.read_at).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Patient Inbox</h1>
        <p className="text-muted-foreground">
          {unreadCount} unread message{unreadCount !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Messages</CardTitle>
            <CardDescription>Click to view full message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {messages && messages.length > 0 ? (
              messages.map((msg: any) => (
                <div
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={`p-3 border rounded-lg cursor-pointer hover:bg-accent transition-colors ${
                    selectedMessage?.id === msg.id ? "bg-accent" : ""
                  } ${!msg.read_at ? "border-primary" : ""}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {msg.read_at ? (
                        <MailOpen className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Mail className="h-4 w-4 text-primary" />
                      )}
                      <p className="font-medium text-sm">
                        {msg.patient?.first_name} {msg.patient?.last_name}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(msg.created_at), "MMM dd")}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {msg.subject || msg.message_body}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">No messages</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Message Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedMessage ? (
              <div className="space-y-4">
                <div className="border-b pb-4">
                  <p className="font-medium mb-1">
                    From: {selectedMessage.patient?.first_name}{" "}
                    {selectedMessage.patient?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground mb-2">
                    {format(new Date(selectedMessage.created_at), "MMMM dd, yyyy 'at' h:mm a")}
                  </p>
                  {selectedMessage.subject && (
                    <p className="font-medium text-sm">Subject: {selectedMessage.subject}</p>
                  )}
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{selectedMessage.message_body}</p>
                </div>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={() =>
                      sendReplyMutation.mutate({
                        patientId: selectedMessage.patient_id,
                        body: replyText,
                      })
                    }
                    disabled={!replyText.trim() || sendReplyMutation.isPending}
                  >
                    <Reply className="mr-2 h-4 w-4" />
                    Send Reply
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Select a message to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
