import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const medicationSchema = z.object({
  medication_name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  start_date: z.string().min(1, "Start date is required"),
  stop_date: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
  alert_enabled: z.boolean().optional(),
  condition_id: z.string().optional(),
  prescribing_provider: z.string().optional(),
});

type MedicationFormData = z.infer<typeof medicationSchema>;

interface MedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  medication?: any;
  mode: "add" | "edit" | "view";
}

export function MedicationDialog({ open, onOpenChange, patientAccountId, medication, mode }: MedicationDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<MedicationFormData>({
    resolver: zodResolver(medicationSchema),
    defaultValues: medication || {
      medication_name: "",
      dosage: "",
      frequency: "",
      start_date: "",
      stop_date: "",
      notes: "",
      instructions: "",
      alert_enabled: false,
      condition_id: "",
      prescribing_provider: "",
    },
  });

  // Fetch patient's conditions for dropdown
  const { data: conditions } = useQuery({
    queryKey: ["patient-conditions", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_conditions")
        .select("id, condition_name")
        .eq("patient_account_id", patientAccountId)
        .eq("is_active", true)
        .order("condition_name");
      if (error) throw error;
      return data;
    },
    enabled: open && !!patientAccountId,
  });

  const mutation = useOptimisticMutation(
    async (data: MedicationFormData) => {
      const formattedData = {
        medication_name: data.medication_name,
        dosage: data.dosage,
        frequency: data.frequency,
        start_date: data.start_date,
        stop_date: data.stop_date || null,
        notes: data.notes || null,
        instructions: data.instructions || null,
        alert_enabled: data.alert_enabled || false,
        associated_condition_id: data.condition_id || null,
        prescribing_provider: data.prescribing_provider || null,
      };

      if (mode === "edit" && medication) {
        const { error } = await supabase
          .from("patient_medications")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", medication.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_medications")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-medications", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === medication.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID(), is_active: true }];
      },
      successMessage: mode === "edit" ? "Medication updated successfully" : "Medication added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} medication`,
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: MedicationFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Medication" : mode === "edit" ? "Edit Medication" : "View Medication"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="medication_name">Medication Name *</Label>
              <Input
                id="medication_name"
                {...register("medication_name")}
                disabled={isReadOnly}
                className={errors.medication_name ? "border-red-500" : ""}
              />
              {errors.medication_name && (
                <p className="text-sm text-red-500">{errors.medication_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="dosage">Dosage *</Label>
              <Input
                id="dosage"
                {...register("dosage")}
                placeholder="e.g., 10mg"
                disabled={isReadOnly}
                className={errors.dosage ? "border-red-500" : ""}
              />
              {errors.dosage && (
                <p className="text-sm text-red-500">{errors.dosage.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Input
                id="frequency"
                {...register("frequency")}
                placeholder="e.g., twice daily"
                disabled={isReadOnly}
                className={errors.frequency ? "border-red-500" : ""}
              />
              {errors.frequency && (
                <p className="text-sm text-red-500">{errors.frequency.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prescribing_provider">Prescribing Provider</Label>
              <Input
                id="prescribing_provider"
                {...register("prescribing_provider")}
                placeholder="e.g., Dr. Smith"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <Input
                id="start_date"
                type="date"
                {...register("start_date")}
                disabled={isReadOnly}
                className={errors.start_date ? "border-red-500" : ""}
              />
              {errors.start_date && (
                <p className="text-sm text-red-500">{errors.start_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="stop_date">Stop Date</Label>
              <Input
                id="stop_date"
                type="date"
                {...register("stop_date")}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condition_id">Associated Medical Condition</Label>
              <Select
                value={watch("condition_id") || ""}
                onValueChange={(value) => setValue("condition_id", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a condition (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {conditions?.map((condition) => (
                    <SelectItem key={condition.id} value={condition.id}>
                      {condition.condition_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions / Sig</Label>
            <Textarea
              id="instructions"
              {...register("instructions")}
              placeholder="Special instructions for taking this medication"
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes"
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="alert_enabled"
              checked={watch("alert_enabled") || false}
              onCheckedChange={(checked) => setValue("alert_enabled", checked)}
              disabled={isReadOnly}
            />
            <Label htmlFor="alert_enabled">Enable SMS/Email Reminders</Label>
          </div>

          {!isReadOnly && (
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Medication
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
