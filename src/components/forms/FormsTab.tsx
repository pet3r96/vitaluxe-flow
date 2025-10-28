import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssignFormDialog } from "./AssignFormDialog";

export function FormsTab() {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState("");

  const { data: forms } = useQuery({
    queryKey: ["practice-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Form Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms?.map((form: any) => (
          <Card key={form.id}>
            <CardHeader>
              <CardTitle className="text-lg">{form.form_name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{form.form_type}</p>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedFormId(form.id);
                  setShowAssign(true);
                }}
              >
                Assign to Patient
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <AssignFormDialog
        formId={selectedFormId}
        open={showAssign}
        onOpenChange={setShowAssign}
      />
    </div>
  );
}