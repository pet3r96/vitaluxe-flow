import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";

interface AssignFormDialogProps {
  formId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignFormDialog({ formId, open, onOpenChange }: AssignFormDialogProps) {
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [instructions, setInstructions] = useState("");

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
      const { data, error } = await supabase.functions.invoke("assign-form-to-patient", {
        body: { formId, patientIds, dueDate: dueDate || null, customInstructions: instructions },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-form-submissions"] });
      toast.success("Form assigned successfully");
      onOpenChange(false);
      setPatientIds([]);
      setDueDate("");
      setInstructions("");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Form to Patients</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Select Patients *</Label>
            <div className="space-y-2 mt-2 max-h-60 overflow-y-auto border rounded p-2">
              {patients?.map((patient: any) => (
                <label key={patient.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={patientIds.includes(patient.id)}
                    onCheckedChange={(checked) =>
                      setPatientIds(checked ? [...patientIds, patient.id] : patientIds.filter(id => id !== patient.id))
                    }
                  />
                  <span>{patient.first_name} {patient.last_name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label>Due Date (optional)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Label>Instructions (optional)</Label>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => assignMutation.mutate()} disabled={assignMutation.isPending || patientIds.length === 0}>
              {assignMutation.isPending ? "Assigning..." : "Assign Form"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}