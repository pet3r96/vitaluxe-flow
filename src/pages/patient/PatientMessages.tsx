import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageThread } from "@/components/patient/MessageThread";
import { NewMessageDialog } from "@/components/patient/NewMessageDialog";
import { MessageFilters, MessageFiltersState } from "@/components/patient/MessageFilters";
import { useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function PatientMessages() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [filters, setFilters] = useState<MessageFiltersState>({
    status: 'all',
    readStatus: 'all',
    urgency: 'all',
  });

  const { data: threads, refetch } = useQuery({
    queryKey: ["patient-message-threads", filters],
    queryFn: async () => {
      let query = supabase
        .from("patient_messages")
        .select(`
          *,
          practice:profiles!patient_messages_practice_id_fkey(name)
        `);

      // Apply filters
      if (filters.status === 'open') {
        query = query.or('resolved.is.null,resolved.eq.false');
      } else if (filters.status === 'resolved') {
        query = query.eq('resolved', true);
      }

      if (filters.readStatus === 'unread') {
        query = query.is('read_at', null);
      } else if (filters.readStatus === 'read') {
        query = query.not('read_at', 'is', null);
      }

      if (filters.urgency === 'urgent') {
        query = query.eq('urgency', 'urgent');
      } else if (filters.urgency === 'normal') {
        query = query.or('urgency.is.null,urgency.eq.normal');
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      // Group by thread_id if exists, otherwise individual messages
      const grouped = data.reduce((acc: any, msg: any) => {
        const key = msg.thread_id || msg.id;
        if (!acc[key]) acc[key] = [];
        acc[key].push(msg);
        return acc;
      }, {});

      return Object.values(grouped);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground">Secure messaging with your healthcare providers</p>
        </div>
        <Button onClick={() => setShowNewMessage(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Message
        </Button>
      </div>

      <MessageFilters filters={filters} onFiltersChange={setFilters} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Conversations</CardTitle>
            <CardDescription>Your message threads</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {threads && threads.length > 0 ? (
              threads.map((thread: any) => {
                const firstMsg = thread[0];
                return (
                  <div
                    key={firstMsg.id}
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                      selectedThread === firstMsg.id ? "bg-accent" : ""
                    }`}
                    onClick={() => setSelectedThread(firstMsg.id)}
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-medium text-sm truncate">
                            {firstMsg.practice?.name || 'Your Practice'}
                          </p>
                          {!firstMsg.read_at && firstMsg.sender_type !== 'patient' && (
                            <Badge variant="default" className="text-xs h-5">New</Badge>
                          )}
                          {firstMsg.urgency === 'urgent' && (
                            <Badge variant="destructive" className="text-xs h-5">Urgent</Badge>
                          )}
                          {firstMsg.resolved && (
                            <Badge variant="secondary" className="text-xs h-5">Resolved</Badge>
                          )}
                        </div>
                        <p className="text-xs font-medium text-foreground truncate">
                          {firstMsg.subject || 'No subject'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {firstMsg.message_body?.substring(0, 50)}...
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(firstMsg.created_at), "MMM dd, h:mm a")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">No messages yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selectedThread ? (
            <MessageThread threadId={selectedThread} onThreadUpdate={refetch} />
          ) : (
            <CardContent className="py-12 text-center text-muted-foreground">
              Select a conversation to view messages
            </CardContent>
          )}
        </Card>
      </div>

      <NewMessageDialog 
        open={showNewMessage} 
        onOpenChange={setShowNewMessage}
        onSuccess={() => {
          setShowNewMessage(false);
          // Refetch messages to show new thread
        }}
      />
    </div>
  );
}
