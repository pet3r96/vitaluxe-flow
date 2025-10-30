import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, MailOpen, Reply, Plus, Search, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PriorityBadge } from "@/components/internal-chat/PriorityBadge";
import { ThreadView } from "@/components/internal-chat/ThreadView";

export default function PatientInbox() {
  const queryClient = useQueryClient();
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyText, setReplyText] = useState("");
  const [filterTab, setFilterTab] = useState<'active' | 'urgent' | 'resolved'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState<string | null>(null);
  const [showNewMessageDialog, setShowNewMessageDialog] = useState(false);

  // Get practice ID
  const { data: practiceId } = useQuery({
    queryKey: ['user-practice-inbox'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: providerData } = await supabase
        .from("providers")
        .select("practice_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (providerData?.practice_id) return providerData.practice_id;

      const { data: staffData } = await supabase
        .from("practice_staff")
        .select("practice_id")
        .eq("user_id", user.id)
        .maybeSingle();
      
      return staffData?.practice_id;
    },
  });

  // Fetch conversation threads (grouped by thread_id)
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["patient-messages-inbox", practiceId, filterTab, searchQuery, selectedPatientFilter],
    queryFn: async () => {
      if (!practiceId) return [];

      let query = supabase
        .from("patient_messages")
        .select(`
          *,
          patient:patient_accounts(first_name, last_name, email)
        `)
        .eq("practice_id", practiceId)
        .order("created_at", { ascending: false });

      // Apply tab filters
      if (filterTab === 'active') {
        query = query.eq('resolved', false);
      } else if (filterTab === 'urgent') {
        query = query.eq('urgency', 'urgent').eq('resolved', false);
      } else if (filterTab === 'resolved') {
        query = query.eq('resolved', true);
      }

      // Apply search
      if (searchQuery) {
        query = query.or(`subject.ilike.%${searchQuery}%,message_body.ilike.%${searchQuery}%`);
      }

      // Apply patient filter
      if (selectedPatientFilter) {
        query = query.eq('patient_id', selectedPatientFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Group by thread_id and keep only the most recent message from each thread
      const threadsMap = new Map();
      (data || []).forEach((msg: any) => {
        const threadId = msg.thread_id || msg.id;
        if (!threadsMap.has(threadId) || new Date(msg.created_at) > new Date(threadsMap.get(threadId).created_at)) {
          threadsMap.set(threadId, msg);
        }
      });
      
      return Array.from(threadsMap.values()).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!practiceId
  });

  // Realtime subscription for patient messages
  useEffect(() => {
    if (!practiceId) return;

    const channel = supabase
      .channel('patient-inbox-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_messages',
          filter: `practice_id=eq.${practiceId}`
        },
        (payload) => {
          console.log('Patient message change:', payload);
          queryClient.invalidateQueries({ queryKey: ["patient-messages-inbox", practiceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId, queryClient]);

  // Fetch unique patients for filter
  const { data: patients = [] } = useQuery({
    queryKey: ['inbox-patients', practiceId],
    queryFn: async () => {
      if (!practiceId) return [];
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('id, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data;
    },
    enabled: !!practiceId
  });

  // Calculate counts
  const unreadCount = useMemo(() => 
    messages?.filter((m) => !m.read_at).length || 0,
    [messages]
  );

  const activeCount = useMemo(() => 
    messages?.filter((m) => !m.resolved).length || 0,
    [messages]
  );

  const urgentCount = useMemo(() => 
    messages?.filter((m) => m.urgency === 'urgent' && !m.resolved).length || 0,
    [messages]
  );

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
    mutationFn: async ({ patientId, body, threadId, subject }: { patientId: string; body: string; threadId: string; subject?: string }) => {
      const { error } = await supabase.functions.invoke("send-patient-message", {
        body: { 
          patient_id: patientId, 
          message_body: body, 
          sender_type: "provider",
          thread_id: threadId,
          parent_message_id: threadId,
          subject: subject
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-messages-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["thread-messages"] });
      toast.success("Reply sent");
      setReplyText("");
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

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Sidebar - Message List */}
      <div className="w-full lg:w-[340px] border-r flex flex-col h-full bg-background">
        {/* Header */}
        <div className="p-4 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Patient Messages</h2>
            <Button size="icon" onClick={() => setShowNewMessageDialog(true)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)} className="px-4 pt-4">
          <TabsList className="w-full justify-between">
            <TabsTrigger value="active" className="text-xs flex-1">
              Active
              {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{activeCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="urgent" className="text-xs flex-1">
              Urgent
              {urgentCount > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">{urgentCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs flex-1">
              Resolved
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="p-4 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedPatientFilter || 'all'} onValueChange={(v) => setSelectedPatientFilter(v === 'all' ? null : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by patient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Patients</SelectItem>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Message List */}
        <ScrollArea className="flex-1">
          {messagesLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : messages && messages.length > 0 ? (
            messages.map((msg: any) => {
              const initials = `${msg.patient?.first_name?.[0] || ''}${msg.patient?.last_name?.[0] || ''}`.toUpperCase();
              return (
                <div
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg)}
                  className={cn(
                    "flex gap-3 p-4 border-b cursor-pointer transition-colors hover:bg-accent",
                    selectedMessage?.id === msg.id && "bg-accent",
                    !msg.read_at && "bg-accent/50"
                  )}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h4 className={cn(
                        "text-sm truncate flex-1",
                        !msg.read_at ? "font-semibold" : "font-medium"
                      )}>
                        {msg.subject || "No Subject"}
                      </h4>
                      <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                        {format(new Date(msg.created_at), 'MMM dd')}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground truncate mb-2">
                      {msg.sender_type === 'patient' ? `${msg.patient?.first_name} ${msg.patient?.last_name}` : 'You'}: {msg.message_body}
                    </p>

                    <div className="flex items-center gap-2 flex-wrap">
                      {msg.urgency && (
                        <PriorityBadge priority={msg.urgency} />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {!msg.read_at && (
                      <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                        1
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No messages found</p>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Side - Message Details */}
      <div className="flex-1 flex flex-col"  >

        <Card className="flex-1 m-4 flex flex-col">
          <CardHeader>
            <CardTitle>Message Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            {selectedMessage ? (
              <ThreadView 
                selectedMessage={selectedMessage} 
                replyText={replyText}
                setReplyText={setReplyText}
                sendReplyMutation={sendReplyMutation}
              />
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
