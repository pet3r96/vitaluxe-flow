import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
  const [patientId, setPatientId] = useState("");
  const [message, setMessage] = useState("");

  const { data: patients } = useQuery({
    queryKey: ["patients-select", effectivePracticeId],
    queryFn: async () => {
      if (!effectivePracticeId) return [];
      const { data, error } = await supabase
        .from("patients" as any)
        .select("id, first_name, last_name")
        .eq("practice_id", effectivePracticeId)
        .order("last_name");
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!effectivePracticeId,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!patientId) throw new Error("Please select a patient");

      const { data, error } = await supabase.functions.invoke("assign-document-to-patient", {
        body: { documentId, patientId, message },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-documents"] });
      toast.success("Document assigned successfully");
      onOpenChange(false);
      setPatientId("");
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
            <Label>Select Patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients?.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.first_name} {patient.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              disabled={assignMutation.isPending || !patientId}
            >
              {assignMutation.isPending ? "Assigning..." : "Assign Document"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}