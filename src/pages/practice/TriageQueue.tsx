import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, Info, User } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function TriageQueue() {
  const queryClient = useQueryClient();

  const { data: submissions } = useQuery({
    queryKey: ["triage-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_triage_submissions")
        .select(`
          *,
          patient:patient_accounts(first_name, last_name, phone, email)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, reviewed }: { id: string; reviewed: boolean }) => {
      const { error } = await supabase
        .from("patient_triage_submissions")
        .update({ 
          reviewed_at: reviewed ? new Date().toISOString() : null,
          reviewed_by: reviewed ? (await supabase.auth.getUser()).data.user?.id : null
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["triage-submissions"] });
      toast.success("Status updated");
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });

  const getUrgencyIcon = (level: string) => {
    switch (level) {
      case "emergency":
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case "urgent":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getUrgencyBadge = (level: string) => {
    const variants: Record<string, "destructive" | "default" | "secondary"> = {
      emergency: "destructive",
      urgent: "default",
      routine: "secondary",
    };
    return (
      <Badge variant={variants[level] || "secondary"}>
        {level?.toUpperCase() || "ROUTINE"}
      </Badge>
    );
  };

  const pending = submissions?.filter((s) => !s.reviewed_at);
  const reviewed = submissions?.filter((s) => s.reviewed_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Triage Queue</h1>
        <p className="text-muted-foreground">
          {pending?.length || 0} submission{pending?.length !== 1 ? "s" : ""} pending review
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emergency</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions?.filter((s) => s.urgency_level === "emergency").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions?.filter((s) => s.urgency_level === "urgent").length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Routine</CardTitle>
            <Info className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {submissions?.filter((s) => s.urgency_level === "routine").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Review</CardTitle>
          <CardDescription>AI-analyzed symptom submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {pending && pending.length > 0 ? (
            <div className="space-y-4">
              {pending.map((submission: any) => {
                // Parse symptoms JSON safely
                const symptoms = (() => {
                  try {
                    return typeof submission.symptoms === 'string' 
                      ? JSON.parse(submission.symptoms) 
                      : submission.symptoms;
                  } catch {
                    return submission.symptoms_description || 'N/A';
                  }
                })();

                return (
                  <div key={submission.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getUrgencyIcon(submission.urgency_level)}
                        <div>
                          <p className="font-medium">
                            {submission.patient?.first_name} {submission.patient?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(submission.created_at), "MMM dd, yyyy 'at' h:mm a")}
                          </p>
                        </div>
                      </div>
                      {getUrgencyBadge(submission.urgency_level)}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="font-medium text-muted-foreground">Chief Complaint:</p>
                        <p>{submission.chief_complaint}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Symptoms:</p>
                        <p>{typeof symptoms === 'string' ? symptoms : JSON.stringify(symptoms)}</p>
                      </div>
                      {submission.ai_recommendation && (
                        <div className="bg-muted p-3 rounded">
                          <p className="font-medium text-muted-foreground mb-1">AI Analysis:</p>
                          <p>{submission.ai_recommendation}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          updateStatusMutation.mutate({ id: submission.id, reviewed: true })
                        }
                      >
                        Mark Reviewed
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateStatusMutation.mutate({ id: submission.id, reviewed: true })
                        }
                      >
                        Follow Up
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No pending submissions</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
