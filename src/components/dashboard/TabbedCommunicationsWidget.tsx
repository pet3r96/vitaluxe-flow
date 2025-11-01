import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Bell, Inbox, Calendar as CalendarIcon, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { useEffect, useCallback } from "react";
import { realtimeManager } from "@/lib/realtimeManager";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { PatientQuickAccessButton } from "@/components/patients/PatientQuickAccessButton";

export function TabbedCommunicationsWidget() {
  const navigate = useNavigate();
  const { user, effectiveRole, effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();

  // Unread Patient Messages Query
  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-patient-messages-dashboard", user?.id, effectivePracticeId],
    queryFn: async () => {
      if (!user?.id || !effectivePracticeId) return { count: 0, subjects: [] };
      
      try {
        const { data: messages, error } = await supabase
          .from("patient_messages")
          .select(`
            id,
            thread_id,
            subject,
            message_body,
            created_at,
            sender_type,
            patient:patient_accounts(first_name, last_name)
          `)
          .eq("practice_id", effectivePracticeId)
          .eq("sender_type", "patient")
          .is("read_at", null)
          .eq("resolved", false)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const threadsMap = new Map();
        (messages || []).forEach((msg: any) => {
          const threadId = msg.thread_id || msg.id;
          if (!threadsMap.has(threadId)) {
            threadsMap.set(threadId, msg);
          }
        });

        const uniqueThreads = Array.from(threadsMap.values());

        return {
          count: uniqueThreads.length,
          subjects: uniqueThreads.slice(0, 5).map((msg: any) => {
            const patientName = msg.patient 
              ? `${msg.patient.first_name} ${msg.patient.last_name}`
              : 'Unknown Patient';
            return `${msg.subject} - ${patientName}`;
          })
        };
      } catch (error) {
        console.error("Failed to fetch patient messages:", error);
        return { count: 0, subjects: [] };
      }
    },
    staleTime: 60000,
    refetchInterval: 30000,
  });

  // Unread Internal Chat Query
  const { data: unreadInternalChat } = useQuery({
    queryKey: ["unread-internal-chat", user?.id, effectiveRole, effectivePracticeId],
    queryFn: async () => {
      if (!user?.id || !effectivePracticeId) return { count: 0, senders: [] };

      try {
        const { data: messages, error } = await supabase
          .from("internal_messages")
          .select("id, subject, created_by, completed")
          .eq("practice_id", effectivePracticeId)
          .eq("completed", false)
          .neq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) throw error;
        if (!messages || messages.length === 0) {
          return { count: 0, senders: [] };
        }

        const creatorIds = [...new Set(messages.map(m => m.created_by))];
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", creatorIds);

        const creatorsMap = new Map(creators?.map(c => [c.id, c.name]) || []);
        const senders = messages.map(m => creatorsMap.get(m.created_by) || "Unknown");

        return {
          count: messages.length,
          senders: senders.slice(0, 5)
        };
      } catch (error) {
        console.error("Failed to fetch internal chat:", error);
        return { count: 0, senders: [] };
      }
    },
    staleTime: 60000,
  });

  // Follow-ups Query
  const { data: followUps, isLoading: followUpsLoading } = useQuery({
    queryKey: ["follow-up-reminders"],
    queryFn: async () => {
      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const { data, error } = await supabase
        .from("patient_follow_ups" as any)
        .select(`
          *,
          patient:patient_accounts!patient_follow_ups_patient_id_fkey(id, first_name, last_name)
        `)
        .eq("status", "pending")
        .lte("follow_up_date", sevenDaysFromNow.toISOString().split("T")[0])
        .order("follow_up_date", { ascending: true })
        .limit(10);

      if (error) throw error;
      return data as any[];
    },
    staleTime: 2 * 60 * 1000,
  });

  // Mark Complete Mutation
  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patient_follow_ups" as any)
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Follow-up marked as complete");
    },
    onError: (error) => {
      toast.error("Failed to update follow-up");
      console.error(error);
    },
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.id || !effectivePracticeId) return;

    const patientMessagesChannel = supabase
      .channel('dashboard-patient-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patient_messages',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-patient-messages-dashboard'] });
        }
      )
      .subscribe();

    const internalMessagesChannel = supabase
      .channel('dashboard-internal-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_messages',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unread-internal-chat'] });
        }
      )
      .subscribe();

    realtimeManager.subscribe('patient_follow_ups');

    return () => {
      patientMessagesChannel.unsubscribe();
      internalMessagesChannel.unsubscribe();
    };
  }, [user?.id, effectivePracticeId, queryClient]);

  const getDateBadge = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (isPast(date) && !isToday(date)) {
      return <Badge variant="destructive">Overdue</Badge>;
    }
    if (isToday(date)) {
      return <Badge className="bg-orange-500">Due Today</Badge>;
    }
    return <Badge variant="secondary">Upcoming</Badge>;
  }, []);

  const handleFollowUpClick = useCallback((patientId: string) => {
    window.location.href = `/patients/${patientId}?tab=follow-ups`;
  }, []);

  const handleMarkComplete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    markComplete.mutate(id);
  }, [markComplete]);

  return (
    <Card variant="modern" className="h-full">
      <CardHeader className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <MessageSquare className="h-5 w-5" />
          Communications
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs defaultValue="messages" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="messages" className="flex items-center gap-2">
              Messages
              {(unreadMessages?.count || 0) > 0 && (
                <Badge variant="secondary" className="ml-1">{unreadMessages?.count}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="followups" className="flex items-center gap-2">
              Follow-Ups
              {!followUpsLoading && followUps && followUps.length > 0 && (
                <Badge variant="secondary" className="ml-1">{followUps.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="messages" className="mt-0">
            <div className="space-y-5 max-h-[400px] overflow-y-auto">
              {/* Patient Messages Section */}
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Patient Messages</h3>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {unreadMessages?.count || 0}
                  </span>
                </div>
                {unreadMessages && unreadMessages.count > 0 ? (
                  <div className="space-y-2">
                    {unreadMessages.subjects.map((subject: string, idx: number) => (
                      <div key={idx} className="text-sm text-muted-foreground bg-background/50 p-2 rounded-lg truncate">
                        {subject}
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      onClick={() => navigate("/practice/patient-inbox")}
                    >
                      View All Messages
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No unread messages</p>
                )}
              </div>

              {/* Internal Chat Section */}
              <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-green-50/50 to-green-100/30 dark:from-green-950/20 dark:to-green-900/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 flex items-center gap-1.5">
                    <Inbox className="h-4 w-4" />
                    Internal Chat
                  </h3>
                  <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {unreadInternalChat?.count || 0}
                  </span>
                </div>
                {unreadInternalChat && unreadInternalChat.count > 0 ? (
                  <div className="space-y-2">
                    {unreadInternalChat.senders.map((sender: string, idx: number) => (
                      <div key={idx} className="text-sm text-muted-foreground bg-background/50 p-2 rounded-lg truncate">
                        From {sender}
                      </div>
                    ))}
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full mt-2 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                      onClick={() => navigate("/internal-chat")}
                    >
                      View Internal Chat
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No unread chat messages</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="followups" className="mt-0">
            {followUpsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : followUps && followUps.length > 0 ? (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {followUps.map((followUp) => (
                  <div
                    key={followUp.id}
                    className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-rose-50/50 to-rose-100/30 dark:from-rose-950/20 dark:to-rose-900/10 hover:scale-[1.01] cursor-pointer transition-all duration-200"
                    onClick={() => handleFollowUpClick(followUp.patient_id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-semibold truncate flex-1">
                          {followUp.patient 
                            ? `${followUp.patient.first_name} ${followUp.patient.last_name}`
                            : "Unknown Patient"}
                        </div>
                        {followUp.patient?.id && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <PatientQuickAccessButton
                              patientId={followUp.patient.id}
                              patientName={`${followUp.patient.first_name} ${followUp.patient.last_name}`}
                              variant="icon"
                              size="sm"
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground truncate mb-2">
                        {followUp.reason}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {getDateBadge(followUp.follow_up_date)}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />
                          {format(new Date(followUp.follow_up_date), "MMM d")}
                        </span>
                        {followUp.priority && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            followUp.priority === 'urgent' ? 'bg-destructive text-destructive-foreground' :
                            followUp.priority === 'high' ? 'bg-orange-500 text-white' :
                            followUp.priority === 'medium' ? 'bg-yellow-500 text-white' :
                            'bg-blue-500 text-white'
                          }`}>
                            {followUp.priority}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:bg-green-100 dark:hover:bg-green-900/30"
                      onClick={(e) => handleMarkComplete(e, followUp.id)}
                      disabled={markComplete.isPending}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-16 w-16 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No upcoming follow-ups</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
