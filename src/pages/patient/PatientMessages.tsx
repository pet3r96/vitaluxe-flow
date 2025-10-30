import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MessageThread } from "@/components/patient/MessageThread";
import { NewMessageDialog } from "@/components/patient/NewMessageDialog";
import { useState, useEffect } from "react";
import { MessageSquare, Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function PatientMessages() {
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [filterTab, setFilterTab] = useState<'active' | 'resolved'>('active');
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: threads } = useQuery({
    queryKey: ["patient-message-threads", filterTab, searchQuery],
    queryFn: async () => {
      let query = supabase
        .from("patient_messages")
        .select(`
          *,
          practice:profiles!patient_messages_practice_id_fkey(name)
        `)
        .is('parent_message_id', null);  // Only fetch root messages

      // Apply status filter
      if (filterTab === 'active') {
        query = query.or('resolved.is.null,resolved.eq.false');
      } else if (filterTab === 'resolved') {
        query = query.eq('resolved', true);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      let result = data || [];

      // Apply search filter
      if (searchQuery.trim()) {
        result = result.filter((msg: any) => {
          const searchLower = searchQuery.toLowerCase();
          return (
            msg.subject?.toLowerCase().includes(searchLower) ||
            msg.message_body?.toLowerCase().includes(searchLower) ||
            msg.practice?.name?.toLowerCase().includes(searchLower)
          );
        });
      }

      return result;
    },
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel('patient-messages-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_messages',
          filter: 'parent_message_id=is.null'
        },
        () => {
          // Only invalidate active queries
          queryClient.invalidateQueries({ 
            queryKey: ['patient-message-threads'],
            refetchType: 'active'
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const activeCount = threads?.filter((t: any) => !t.resolved).length || 0;
  const resolvedCount = threads?.filter((t: any) => t.resolved).length || 0;

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] gap-4">
        {/* Left Sidebar - Conversations */}
        <Card className="w-80 flex flex-col">
          <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Messages</h2>
            <Button
              size="icon"
              onClick={() => setShowNewMessage(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as 'active' | 'resolved')}>
              <TabsList className="w-full">
                <TabsTrigger value="active" className="flex-1">
                  Active
                  {activeCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {activeCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="resolved" className="flex-1">
                  Resolved
                  {resolvedCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                      {resolvedCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {threads && threads.length > 0 ? (
                threads.map((msg: any) => {
                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedThread === msg.id
                          ? "bg-accent"
                          : "hover:bg-accent/50"
                      }`}
                      onClick={() => setSelectedThread(msg.id)}
                    >
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-4 w-4 mt-1 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="font-medium text-sm truncate">
                              {msg.practice?.name || 'Your Practice'}
                            </p>
                            {!msg.read_at && msg.sender_type !== 'patient' && (
                              <Badge variant="default" className="text-xs h-5">New</Badge>
                            )}
                            {msg.urgency === 'urgent' && (
                              <Badge variant="destructive" className="text-xs h-5">Urgent</Badge>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground truncate">
                            {msg.subject || 'No subject'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {msg.message_body?.substring(0, 50)}...
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.created_at), "MMM dd, h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No messages found
                </p>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Right Side - Message Thread */}
        <Card className="flex-1 flex flex-col">
          {selectedThread ? (
            <MessageThread 
              threadId={selectedThread} 
              onThreadUpdate={() => {
                queryClient.invalidateQueries({ 
                  queryKey: ['patient-message-threads'],
                  refetchType: 'active'
                });
              }} 
            />
          ) : (
            <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
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
          queryClient.invalidateQueries({ 
            queryKey: ['patient-message-threads'],
            refetchType: 'active'
          });
        }}
      />
    </>
  );
}
