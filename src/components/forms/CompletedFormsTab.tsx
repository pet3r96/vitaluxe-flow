import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { FormSubmissionViewer } from "./FormSubmissionViewer";

export function CompletedFormsTab() {
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showViewer, setShowViewer] = useState(false);

  const { data: submissions, isLoading } = useQuery({
    queryKey: ["completed-form-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_form_submissions" as any)
        .select("*, practice_forms(form_name), patients(first_name, last_name)")
        .in("status", ["completed", "signed"])
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  if (isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  return (
    <div className="space-y-3">
      {submissions?.map((sub: any) => (
        <Card key={sub.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-semibold">{sub.practice_forms?.form_name}</h3>
                <p className="text-sm text-muted-foreground">
                  {sub.patients?.first_name} {sub.patients?.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Completed: {sub.completed_at ? format(new Date(sub.completed_at), "MMM d, yyyy") : "N/A"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={sub.status === "signed" ? "default" : "secondary"}>{sub.status}</Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setSelectedSubmission(sub);
                    setShowViewer(true);
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <FormSubmissionViewer
        open={showViewer}
        onOpenChange={setShowViewer}
        submission={selectedSubmission}
      />
    </div>
  );
}