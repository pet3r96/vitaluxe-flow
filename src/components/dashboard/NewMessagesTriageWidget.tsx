import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function NewMessagesTriageWidget() {
  const navigate = useNavigate();

  const { data: unreadMessages } = useQuery({
    queryKey: ["unread-messages-count"],
    queryFn: async () => {
      const { data: threads } = await supabase
        .from("message_threads")
        .select("id, subject, updated_at, messages!inner(read)")
        .eq("messages.read", false)
        .order("updated_at", { ascending: false })
        .limit(3);

      return threads || [];
    },
    refetchInterval: 30000,
  });

  const { data: pendingTriages } = useQuery({
    queryKey: ["pending-triages-count"],
    queryFn: async () => {
      const { data } = await supabase
        .from("triage_submissions" as any)
        .select("id, created_at, patient_accounts!inner(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(3);

      return (data || []) as any[];
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
                    {triage.patient_accounts?.full_name}
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