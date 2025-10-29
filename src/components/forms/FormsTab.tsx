import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { FormCard } from "./FormCard";
import { AssignFormDialog } from "./AssignFormDialog";
import { FormBuilder } from "./FormBuilder";
import { UploadFormDialog } from "./UploadFormDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export function FormsTab() {
  const { effectivePracticeId } = useAuth();
  const [showAssign, setShowAssign] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState("");
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: forms, isLoading } = useQuery({
    queryKey: ["practice-forms", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];
      const { data, error } = await supabase
        .from("practice_forms")
        .select("*")
        .eq("practice_id", effectivePracticeId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!effectivePracticeId,
  });

  const archiveFormMutation = useMutation({
    mutationFn: async (formId: string) => {
      const { error } = await supabase
        .from("practice_forms")
        .update({ is_active: false })
        .eq("id", formId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-forms"] });
      toast.success("Form archived successfully");
    },
    onError: (error) => {
      toast.error("Failed to archive form: " + error.message);
    },
  });

  const handleEdit = (form: any) => {
    setEditingForm(form);
    setShowFormBuilder(true);
  };

  const handleArchive = (formId: string) => {
    if (confirm("Are you sure you want to archive this form?")) {
      archiveFormMutation.mutate(formId);
    }
  };

  const handleDuplicate = () => {
    toast.info("Duplicate feature coming soon");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setShowUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload PDF Form
        </Button>
        <Button onClick={() => {
          setEditingForm(null);
          setShowFormBuilder(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Form
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : forms && forms.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forms.map((form: any) => (
            <FormCard
              key={form.id}
              form={form}
              onAssign={(formId) => {
                setSelectedFormId(formId);
                setShowAssign(true);
              }}
              onEdit={() => handleEdit(form)}
              onArchive={() => handleArchive(form.id)}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No forms yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first form template to get started
          </p>
          <Button onClick={() => setShowFormBuilder(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Form
          </Button>
        </div>
      )}

      <AssignFormDialog
        formId={selectedFormId}
        open={showAssign}
        onOpenChange={setShowAssign}
      />

      <FormBuilder
        open={showFormBuilder}
        onOpenChange={(open) => {
          setShowFormBuilder(open);
          if (!open) setEditingForm(null);
        }}
        form={editingForm}
      />

      <UploadFormDialog
        open={showUploadDialog}
        onOpenChange={setShowUploadDialog}
      />
    </div>
  );
}
