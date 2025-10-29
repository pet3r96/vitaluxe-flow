import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Check, X, Edit2, AlertCircle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { FollowUpDialog } from "./FollowUpDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FollowUpManagerProps {
  patientId: string;
  patientName: string;
}

export function FollowUpManager({ patientId, patientName }: FollowUpManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const queryClient = useQueryClient();

  const { data: followUps, isLoading } = useQuery({
    queryKey: ["patient-follow-ups", patientId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("patient_follow_ups" as any)
        .select(`
          *,
          assigned_user:assigned_to(name),
          creator:created_by(name)
        `)
        .eq("patient_id", patientId)
        .order("follow_up_date", { ascending: true });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const markComplete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patient_follow_ups" as any)
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Follow-up marked as complete");
    },
    onError: () => {
      toast.error("Failed to update follow-up");
    },
  });

  const cancelFollowUp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patient_follow_ups" as any)
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-follow-ups"] });
      queryClient.invalidateQueries({ queryKey: ["follow-up-reminders"] });
      toast.success("Follow-up cancelled");
    },
    onError: () => {
      toast.error("Failed to cancel follow-up");
    },
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-destructive text-destructive-foreground";
      case "high":
        return "bg-orange-500 text-white";
      case "medium":
        return "bg-yellow-500 text-white";
      case "low":
        return "bg-blue-500 text-white";
      default:
        return "bg-secondary";
    }
  };

  const getDateBadge = (dateString: string) => {
    const date = new Date(dateString);
    if (isPast(date) && !isToday(date)) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Overdue
        </Badge>
      );
    }
    if (isToday(date)) {
      return <Badge className="bg-orange-500">Due Today</Badge>;
    }
    return <Badge variant="secondary">Upcoming</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Follow-Ups for {patientName}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Follow-Up
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : followUps && followUps.length > 0 ? (
            <div className="space-y-3">
              {followUps.map((followUp) => (
                <div
                  key={followUp.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50"
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getDateBadge(followUp.follow_up_date)}
                      <Badge className={getPriorityColor(followUp.priority)}>
                        {followUp.priority}
                      </Badge>
                      {followUp.status !== "pending" && (
                        <Badge variant="outline">{followUp.status}</Badge>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold">
                        {format(new Date(followUp.follow_up_date), "MMM d, yyyy")}
                        {followUp.follow_up_time && ` at ${followUp.follow_up_time}`}
                      </p>
                      <p className="text-sm text-muted-foreground">{followUp.reason}</p>
                      {followUp.notes && (
                        <p className="text-sm text-muted-foreground mt-1">{followUp.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      {followUp.assigned_user && (
                        <span>Assigned to: {followUp.assigned_user.name}</span>
                      )}
                      <span>Created by: {followUp.creator?.name || "Unknown"}</span>
                    </div>
                  </div>
                  {followUp.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingFollowUp(followUp);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markComplete.mutate(followUp.id)}
                        disabled={markComplete.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelFollowUp.mutate(followUp.id)}
                        disabled={cancelFollowUp.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No follow-ups scheduled</p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Follow-Up
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <FollowUpDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingFollowUp(null);
        }}
        patientId={patientId}
        patientName={patientName}
        followUp={editingFollowUp}
      />
    </>
  );
}
