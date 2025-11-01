import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function MessagesAndChatWidget() {
  const navigate = useNavigate();
  const { user, effectiveRole, effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch unread patient messages (support tickets)
  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-patient-messages-dashboard", user?.id, effectivePracticeId],
    queryFn: async () => {
      if (!user?.id || !effectivePracticeId) return { count: 0, subjects: [] };
      
      try {
        console.log('[Dashboard Widget] 📧 Fetching patient messages for practice:', effectivePracticeId);
        
        // Get unread patient messages (messages FROM patients that need responses)
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

        console.log('[Dashboard Widget] ✅ Found', messages?.length || 0, 'unread patient messages');

        // Group by thread_id to show unique conversations
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
          subjects: uniqueThreads.slice(0, 3).map((msg: any) => {
            const patientName = msg.patient 
              ? `${msg.patient.first_name} ${msg.patient.last_name}`
              : 'Unknown Patient';
            return `${msg.subject} - ${patientName}`;
          })
        };
      } catch (error) {
        console.error("[Dashboard Widget] ❌ Failed to fetch patient messages:", error);
        return { count: 0, subjects: [] };
      }
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 30000,
  });

  // Fetch unread internal chat messages
  const { data: unreadInternalChat } = useQuery({
    queryKey: ["unread-internal-chat", user?.id, effectiveRole, effectivePracticeId],
    queryFn: async () => {
      if (!user?.id || !effectivePracticeId) return { count: 0, senders: [] };

      try {
        // Query incomplete messages not created by current user
        const { data: messages, error } = await supabase
          .from("internal_messages")
          .select("id, subject, created_by, completed")
          .eq("practice_id", effectivePracticeId)
          .eq("completed", false)
          .neq("created_by", user.id)
          .order("created_at", { ascending: false })
          .limit(3);

        if (error) throw error;
        if (!messages || messages.length === 0) {
          return { count: 0, senders: [] };
        }

        // Get unique creator IDs
        const creatorIds = [...new Set(messages.map(m => m.created_by))];

        // Fetch creator names
        const { data: creators } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", creatorIds);

        // Map creator names to messages
        const creatorsMap = new Map(creators?.map(c => [c.id, c.name]) || []);
        const senders = messages.map(m => creatorsMap.get(m.created_by) || "Unknown");

        return {
          count: messages.length,
          senders: senders.slice(0, 3)
        };
      } catch (error) {
        console.error("Failed to fetch internal chat:", error);
        return { count: 0, senders: [] };
      }
    },
    staleTime: 60000, // 1 minute
  });

  // Real-time subscriptions for instant updates
  useEffect(() => {
    if (!user?.id || !effectivePracticeId) return;

    // Subscribe to patient messages for dashboard updates
    const patientMessagesChannel = supabase
      .channel('dashboard-patient-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'patient_messages',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        (payload) => {
          console.log('[Dashboard Widget] 🔔 New patient message received:', payload);
          queryClient.invalidateQueries({ queryKey: ['unread-patient-messages-dashboard'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'patient_messages',
          filter: `practice_id=eq.${effectivePracticeId}`,
        },
        (payload) => {
          console.log('[Dashboard Widget] 📝 Patient message updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['unread-patient-messages-dashboard'] });
        }
      )
      .subscribe();

    // Subscribe to internal messages
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
        (payload) => {
          console.log('[Dashboard Widget] 📬 Internal message updated:', payload);
          queryClient.invalidateQueries({ queryKey: ['unread-internal-chat'] });
        }
      )
      .subscribe();

    return () => {
      patientMessagesChannel.unsubscribe();
      internalMessagesChannel.unsubscribe();
    };
  }, [user?.id, effectivePracticeId, queryClient]);

  return (
    <Card variant="modern">
      <CardHeader className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20">
        <CardTitle className="flex items-center gap-2 text-purple-700 dark:text-purple-300">
          <MessageSquare className="h-5 w-5" />
          Communications
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-5">
        {/* Patient Messages Section */}
        <div className="space-y-3 p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Patient Messages</h3>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {unreadMessages?.count || 0}
              </span>
            </div>
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
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                {unreadInternalChat?.count || 0}
              </span>
            </div>
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
      </CardContent>
    </Card>
  );
}
