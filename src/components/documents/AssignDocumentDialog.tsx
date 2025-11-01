import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MultiPatientSelect } from "./MultiPatientSelect";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface AssignDocumentDialogProps {
  documentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignDocumentDialog({ documentId, open, onOpenChange }: AssignDocumentDialogProps) {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPatientIds, setSelectedPatientIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (selectedPatientIds.length === 0) throw new Error("Please select at least one patient");

      const { data, error } = await supabase.functions.invoke("assign-document-to-patient", {
        body: { documentId, patientIds: selectedPatientIds, message },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-documents", effectivePracticeId] });
      toast.success("Document assigned successfully");
      onOpenChange(false);
      setSelectedPatientIds([]);
      setMessage("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to assign document");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Document to Patient</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Select Patients *</Label>
            <MultiPatientSelect
              selectedPatientIds={selectedPatientIds}
              onSelectedChange={setSelectedPatientIds}
            />
          </div>

          <div>
            <Label>Message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message for the patient"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending || selectedPatientIds.length === 0}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Document"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}