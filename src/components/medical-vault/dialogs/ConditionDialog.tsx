import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";

const conditionSchema = z.object({
  condition_name: z.string().min(1, "Condition name is required"),
  description: z.string().optional(),
  icd10_code: z.string().optional(),
  date_diagnosed: z.string().min(1, "Date diagnosed is required"),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  treatment_plan: z.string().optional(),
  associated_provider: z.string().optional(),
  notes: z.string().optional(),
});

type ConditionFormData = z.infer<typeof conditionSchema>;

interface ConditionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  condition?: any;
  mode: "add" | "edit" | "view";
}

export function ConditionDialog({ open, onOpenChange, patientAccountId, condition, mode }: ConditionDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<ConditionFormData>({
    resolver: zodResolver(conditionSchema),
    defaultValues: condition || {
      condition_name: "",
      description: "",
      icd10_code: "",
      date_diagnosed: "",
      severity: undefined,
      treatment_plan: "",
      associated_provider: "",
      notes: "",
    },
  });

  const mutation = useOptimisticMutation(
    async (data: ConditionFormData) => {
      const formattedData = {
        condition_name: data.condition_name,
        description: data.description || null,
        icd10_code: data.icd10_code || null,
        date_diagnosed: data.date_diagnosed,
        severity: data.severity || null,
        treatment_plan: data.treatment_plan || null,
        associated_provider_id: data.associated_provider || null,
        notes: data.notes || null,
      };

      if (mode === "edit" && condition) {
        const { error } = await supabase
          .from("patient_conditions")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", condition.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_conditions")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-conditions", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === condition.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID(), is_active: true }];
      },
      successMessage: mode === "edit" ? "Condition updated successfully" : "Condition added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} condition`,
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: ConditionFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Medical Condition" : mode === "edit" ? "Edit Medical Condition" : "View Medical Condition"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condition_name">Condition Name *</Label>
              <Input
                id="condition_name"
                {...register("condition_name")}
                disabled={isReadOnly}
                className={errors.condition_name ? "border-red-500" : ""}
              />
              {errors.condition_name && (
                <p className="text-sm text-red-500">{errors.condition_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="icd10_code">ICD-10 Code</Label>
              <Input
                id="icd10_code"
                {...register("icd10_code")}
                placeholder="e.g., E11.9"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_diagnosed">Date Diagnosed *</Label>
              <Input
                id="date_diagnosed"
                type="date"
                {...register("date_diagnosed")}
                disabled={isReadOnly}
                className={errors.date_diagnosed ? "border-red-500" : ""}
              />
              {errors.date_diagnosed && (
                <p className="text-sm text-red-500">{errors.date_diagnosed.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={watch("severity") || ""}
                onValueChange={(value: any) => setValue("severity", value === "__none__" ? undefined : value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not specified</SelectItem>
                  <SelectItem value="mild">Mild</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="severe">Severe</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="associated_provider">Associated Provider</Label>
              <Input
                id="associated_provider"
                {...register("associated_provider")}
                placeholder="e.g., Dr. Johnson"
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description / Diagnosis Details</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Detailed information about the condition"
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment_plan">Treatment Plan</Label>
            <Textarea
              id="treatment_plan"
              {...register("treatment_plan")}
              placeholder="Current treatment plan and management"
              disabled={isReadOnly}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes / Attachments</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional notes, labs, imaging, reports"
              disabled={isReadOnly}
              rows={3}
            />
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
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Condition
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
