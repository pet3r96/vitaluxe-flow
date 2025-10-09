import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export const MessagesView = () => {
  const { user } = useAuth();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);

  const { data: threads, refetch: refetchThreads } = useQuery({
    queryKey: ["message-threads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("message_threads")
        .select(`
          *,
          thread_participants!inner(user_id)
        `)
        .eq("thread_participants.user_id", user?.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ["messages", selectedThread],
    queryFn: async () => {
      if (!selectedThread) return [];
      
      const { data, error } = await supabase
        .from("messages")
        .select(`
          *,
          profiles:sender_id(name, email)
        `)
        .eq("thread_id", selectedThread)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedThread,
  });

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedThread) return;

    const { error } = await supabase.from("messages").insert([
      {
        thread_id: selectedThread,
        sender_id: user?.id,
        body: newMessage,
      },
    ]);

    if (error) {
      toast.error("Failed to send message");
    } else {
      setNewMessage("");
      refetchMessages();
      refetchThreads();
    }
  };

  const createThread = async () => {
    if (!newThreadSubject.trim()) return;

    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .insert([{ subject: newThreadSubject }])
      .select()
      .single();

    if (threadError) {
      toast.error("Failed to create thread");
      return;
    }

    // Get admin user ID
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    if (adminUsers) {
      // Add participants
      await supabase.from("thread_participants").insert([
        { thread_id: thread.id, user_id: user?.id },
        { thread_id: thread.id, user_id: adminUsers.user_id },
      ]);
    }

    setShowNewThread(false);
    setNewThreadSubject("");
    refetchThreads();
    toast.success("Thread created successfully");
  };

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      <Card className="col-span-1 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Threads</h2>
          <Button size="sm" onClick={() => setShowNewThread(true)}>
            New Thread
          </Button>
        </div>

        {showNewThread && (
          <div className="mb-4 p-3 border border-border rounded-md space-y-2">
            <Input
              placeholder="Thread subject..."
              value={newThreadSubject}
              onChange={(e) => setNewThreadSubject(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={createThread}>
                Create
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewThread(false);
                  setNewThreadSubject("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-2">
          {threads?.map((thread) => (
            <button
              key={thread.id}
              onClick={() => setSelectedThread(thread.id)}
              className={`w-full p-3 text-left rounded-md transition-colors ${
                selectedThread === thread.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              <div className="flex items-start gap-2">
                <MessageCircle className="h-4 w-4 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{thread.subject}</p>
                  <p className="text-xs opacity-70">
                    {new Date(thread.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </Card>

      <Card className="col-span-2 p-4 flex flex-col">
        {selectedThread ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {messages?.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-md ${
                    message.sender_id === user?.id
                      ? "bg-primary text-primary-foreground ml-auto max-w-[80%]"
                      : "bg-muted mr-auto max-w-[80%]"
                  }`}
                >
                  <p className="text-xs opacity-70 mb-1">
                    {message.profiles?.name || "Unknown"} -{" "}
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                  <p className="whitespace-pre-wrap">{message.body}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
              />
              <Button onClick={sendMessage} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a thread to view messages
          </div>
        )}
      </Card>
    </div>
  );
};
