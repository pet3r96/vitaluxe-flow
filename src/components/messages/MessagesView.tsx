import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

export const MessagesView = () => {
  const { user } = useAuth();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newThreadSubject, setNewThreadSubject] = useState("");
  const [newThreadMessage, setNewThreadMessage] = useState("");
  const [showNewThread, setShowNewThread] = useState(false);
  const [resolvedFilter, setResolvedFilter] = useState<"all" | "unresolved" | "resolved">("unresolved");
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      setIsAdmin(!!data);
    };
    
    checkAdminStatus();
  }, [user?.id]);

  const { data: threads, refetch: refetchThreads } = useQuery({
    queryKey: ["message-threads", resolvedFilter, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from("message_threads")
        .select(`
          *,
          thread_participants!inner(user_id)
        `)
        .eq("thread_participants.user_id", user?.id)
        .order("updated_at", { ascending: false });

      // Apply filter
      if (resolvedFilter === "resolved") {
        query = query.eq("resolved", true);
      } else if (resolvedFilter === "unresolved") {
        query = query.eq("resolved", false);
      }

      const { data: threadsData, error } = await query;
      if (error) throw error;

      // Fetch creator and resolver names
      if (threadsData && threadsData.length > 0) {
        const creatorIds = [...new Set(threadsData.map(t => t.created_by).filter(Boolean))];
        const resolverIds = [...new Set(threadsData.map(t => t.resolved_by).filter(Boolean))];
        const allUserIds = [...new Set([...creatorIds, ...resolverIds])];

        if (allUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, name, email")
            .in("id", allUserIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

          return threadsData.map(thread => ({
            ...thread,
            creator: thread.created_by ? profileMap.get(thread.created_by) : null,
            resolver: thread.resolved_by ? profileMap.get(thread.resolved_by) : null,
          }));
        }
      }

      return threadsData || [];
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
    if (!newThreadSubject.trim() || !newThreadMessage.trim()) {
      toast.error("Please enter both subject and message");
      return;
    }

    const { data: thread, error: threadError } = await supabase
      .from("message_threads")
      .insert([{ subject: newThreadSubject, created_by: user?.id }])
      .select()
      .single();

    if (threadError) {
      toast.error("Failed to create support ticket: " + threadError.message);
      console.error("Thread creation error:", threadError);
      return;
    }

    // Get ALL admin user IDs
    const { data: adminUsers, error: adminError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminError) {
      toast.error("Failed to fetch admins");
      console.error("Admin fetch error:", adminError);
      return;
    }

    if (adminUsers && adminUsers.length > 0) {
      // Add participants: creator + ALL admins (avoiding duplicates)
      const participantIds = new Set([user?.id]);
      adminUsers.forEach(admin => participantIds.add(admin.user_id));
      
      const participants = Array.from(participantIds).map(userId => ({
        thread_id: thread.id,
        user_id: userId
      }));
      
      const { error: participantsError } = await supabase
        .from("thread_participants")
        .insert(participants);

      if (participantsError) {
        toast.error("Failed to add participants");
        console.error("Participants error:", participantsError);
        return;
      }
    }

    // Create the first message
    const { error: messageError } = await supabase
      .from("messages")
      .insert([{
        thread_id: thread.id,
        sender_id: user?.id,
        body: newThreadMessage,
      }]);

    if (messageError) {
      toast.error("Failed to send initial message");
      console.error("Message error:", messageError);
      return;
    }

    setShowNewThread(false);
    setNewThreadSubject("");
    setNewThreadMessage("");
    setSelectedThread(thread.id);
    refetchThreads();
    toast.success("Support ticket created successfully");
  };

  const markAsResolved = async (threadId: string) => {
    const { error } = await supabase
      .from("message_threads")
      .update({ 
        resolved: true, 
        resolved_by: user?.id,
        resolved_at: new Date().toISOString() 
      })
      .eq("id", threadId);
    
    if (error) {
      toast.error("Failed to mark as resolved");
      console.error("Mark resolved error:", error);
    } else {
      toast.success("Ticket marked as resolved");
      // Clear selection if on unresolved filter
      if (resolvedFilter === "unresolved") {
        setSelectedThread(null);
      }
      await refetchThreads();
    }
  };

  const reopenThread = async (threadId: string) => {
    const { error } = await supabase
      .from("message_threads")
      .update({ 
        resolved: false, 
        resolved_by: null,
        resolved_at: null 
      })
      .eq("id", threadId);
    
    if (error) {
      toast.error("Failed to reopen ticket");
      console.error("Reopen error:", error);
    } else {
      toast.success("Ticket reopened");
      // Clear selection if on resolved filter
      if (resolvedFilter === "resolved") {
        setSelectedThread(null);
      }
      await refetchThreads();
    }
  };

  const currentThread = threads?.find(t => t.id === selectedThread);

  return (
    <div className="grid grid-cols-3 gap-6 h-[calc(100vh-12rem)]">
      <Card className="col-span-1 p-4 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isAdmin ? "All Tickets" : "My Tickets"}
          </h2>
          <Button size="sm" onClick={() => setShowNewThread(true)}>
            New Support Ticket
          </Button>
        </div>

        <div className="mb-4">
          <Select value={resolvedFilter} onValueChange={(value: any) => setResolvedFilter(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter tickets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tickets</SelectItem>
              <SelectItem value="unresolved">Unresolved</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {showNewThread && (
          <div className="mb-4 p-3 border border-border rounded-md space-y-2">
            <Input
              placeholder="Ticket subject..."
              value={newThreadSubject}
              onChange={(e) => setNewThreadSubject(e.target.value)}
              maxLength={200}
            />
            <Textarea
              placeholder="Describe your issue..."
              value={newThreadMessage}
              onChange={(e) => setNewThreadMessage(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={createThread}>
                Create Ticket
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowNewThread(false);
                  setNewThreadSubject("");
                  setNewThreadMessage("");
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
                <MessageCircle className="h-4 w-4 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate flex-1">{thread.subject}</p>
                    <Badge 
                      variant={thread.resolved ? "secondary" : "default"}
                      className="flex-shrink-0"
                    >
                      {thread.resolved ? "Resolved" : "Open"}
                    </Badge>
                  </div>
                  {isAdmin && thread.created_by && (thread as any).creator && (
                    <p className="text-xs opacity-70">
                      By: {(thread as any).creator.name}
                    </p>
                  )}
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
            <div className="border-b border-border pb-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{currentThread?.subject}</h3>
                  {currentThread?.resolved && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Resolved by {(currentThread as any).resolver?.name || "Admin"} on{" "}
                      {new Date(currentThread.resolved_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    {!currentThread?.resolved ? (
                      <Button 
                        size="sm" 
                        onClick={() => markAsResolved(selectedThread)}
                      >
                        Mark as Resolved
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => reopenThread(selectedThread)}
                      >
                        Reopen Ticket
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

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

            {!currentThread?.resolved ? (
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
            ) : (
              <div className="p-3 bg-muted rounded-md text-center">
                <p className="text-sm text-muted-foreground">
                  This ticket is resolved. {isAdmin ? "Reopen it" : "Contact an admin"} to continue the conversation.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a ticket to view messages
          </div>
        )}
      </Card>
    </div>
  );
};
