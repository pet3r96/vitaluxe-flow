import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export function NewMessagesTriageWidget() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      // Query for unread messages using message_thread_read_status
      const { data: readStatus } = await supabase
        .from("message_thread_read_status")
        .select("thread_id")
        .eq("user_id", user.id)
        .is("last_read_at", null)
        .limit(3);

      if (!readStatus || readStatus.length === 0) return [];

      const threadIds = readStatus.map(status => status.thread_id);
      
      const { data: threads } = await supabase
        .from("message_threads")
        .select("id, subject, updated_at")
        .in("id", threadIds)
        .order("updated_at", { ascending: false })
        .limit(3);

      return threads || [];
    },
    refetchInterval: 30000,
    enabled: !!user?.id,
  });

  const { data: pendingTriages } = useQuery({
    queryKey: ["pending-triages-count"],
    queryFn: async () => {
      // @ts-ignore - Avoid deep type instantiation
      const { data: triages } = await supabase
        .from("patient_triage_submissions")
        .select("id, created_at, patient_id")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);

      if (!triages || triages.length === 0) return [];

      // Fetch patient names separately to avoid type issues
      const patientIds = triages.map((t: any) => t.patient_id);
      const { data: patients } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name")
        .in("id", patientIds);

      // Combine the data
      return triages.map((triage: any) => ({
        ...triage,
        patient_accounts: patients?.find(p => p.id === triage.patient_id)
      }));
    },
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Messages & Triages
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unread Messages Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">Unread Messages</h4>
            <Badge variant="secondary">{unreadMessages?.length || 0}</Badge>
          </div>
          {unreadMessages && unreadMessages.length > 0 ? (
            <div className="space-y-2">
              {unreadMessages.map((thread) => (
                <div
                  key={thread.id}
                  className="text-sm p-2 rounded bg-muted/50 hover:bg-muted cursor-pointer"
                  onClick={() => navigate("/messages")}
                >
                  <div className="font-medium truncate">{thread.subject}</div>
                </div>
              ))}
              <Button
                variant="link"
                size="sm"
                className="w-full"
                onClick={() => navigate("/messages")}
              >
                View All Messages
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No unread messages</p>
          )}
        </div>

        {/* Pending Triages Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Pending Triages
            </h4>
            <Badge variant="secondary">{pendingTriages?.length || 0}</Badge>
          </div>
          {pendingTriages && pendingTriages.length > 0 ? (
            <div className="space-y-2">
              {pendingTriages.map((triage) => (
                <div
                  key={triage.id}
                  className="text-sm p-2 rounded bg-muted/50 hover:bg-muted cursor-pointer"
                  onClick={() => navigate("/triage-queue")}
                >
                  <div className="font-medium truncate">
                    {triage.patient_accounts?.first_name} {triage.patient_accounts?.last_name}
                  </div>
                </div>
              ))}
              <Button
                variant="link"
                size="sm"
                className="w-full"
                onClick={() => navigate("/triage-queue")}
              >
                View Triage Queue
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No pending triages</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
