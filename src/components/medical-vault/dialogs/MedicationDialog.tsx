import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const medicationSchema = z.object({
  medication_name: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  start_date: z.string().min(1, "Start date is required").refine(
    (val) => /^\d{4}-\d{2}$/.test(val),
    "Start date must be in YYYY-MM format"
  ),
  stop_date_option: z.enum(["1-10-days", "3-months", "ongoing"]).optional(),
  stop_date: z.string().optional(),
  notes: z.string().optional(),
  instructions: z.string().optional(),
  alert_enabled: z.boolean().optional(),
  condition_id: z.string().optional(),
  prescribing_provider_id: z.string().optional(),
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
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<MedicationFormData>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      medication_name: "",
      dosage: "",
      frequency: "",
      start_date: "",
      stop_date_option: "ongoing",
      stop_date: "",
      notes: "",
      instructions: "",
      alert_enabled: false,
      condition_id: "",
      prescribing_provider_id: "",
    },
  });

  const startDate = watch("start_date");
  const stopDateOption = watch("stop_date_option");

  // Handle edit mode - convert existing dates and determine stop_date_option
  useEffect(() => {
    if (medication && open) {
      // Convert start_date from YYYY-MM-DD to YYYY-MM
      const monthYear = medication.start_date ? medication.start_date.substring(0, 7) : "";
      
      // Determine stop_date_option from existing stop_date
      let calculatedOption: "1-10-days" | "3-months" | "ongoing" = "ongoing";
      if (medication.stop_date && medication.start_date) {
        const start = new Date(medication.start_date);
        const stop = new Date(medication.stop_date);
        const diffDays = Math.floor((stop.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 10) {
          calculatedOption = "1-10-days";
        } else if (diffDays > 10 && diffDays <= 100) {
          calculatedOption = "3-months";
        }
      }

      reset({
        medication_name: medication.medication_name || "",
        dosage: medication.dosage || "",
        frequency: medication.frequency || "",
        start_date: monthYear,
        stop_date_option: calculatedOption,
        stop_date: medication.stop_date || "",
        notes: medication.notes || "",
        instructions: medication.instructions || "",
        alert_enabled: medication.alert_enabled || false,
        condition_id: medication.associated_condition_id || "",
        prescribing_provider_id: medication.prescribing_provider_id || "",
      });
    } else if (!medication && open) {
      reset({
        medication_name: "",
        dosage: "",
        frequency: "",
        start_date: "",
        stop_date_option: "ongoing",
        stop_date: "",
        notes: "",
        instructions: "",
        alert_enabled: false,
        condition_id: "",
        prescribing_provider_id: "",
      });
    }
  }, [medication, open, reset]);

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
      // Convert YYYY-MM to YYYY-MM-01 for database storage
      const fullStartDate = data.start_date + "-01";
      
      const formattedData = {
        medication_name: data.medication_name,
        dosage: data.dosage,
        frequency: data.frequency,
        start_date: fullStartDate,
        stop_date: data.stop_date || null,
        notes: data.notes || null,
        instructions: data.instructions || null,
        alert_enabled: data.alert_enabled || false,
        associated_condition_id: data.condition_id || null,
        prescribing_provider_id: data.prescribing_provider_id || null,
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
              <Label htmlFor="prescribing_provider_id">Prescribing Provider</Label>
              <Input
                id="prescribing_provider_id"
                {...register("prescribing_provider_id")}
                placeholder="e.g., Dr. Smith"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date (Month & Year) *</Label>
              <Input
                id="start_date"
                type="month"
                {...register("start_date")}
                disabled={isReadOnly}
                className={errors.start_date ? "border-red-500" : ""}
              />
              {errors.start_date && (
                <p className="text-sm text-red-500">{errors.start_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Stop Date</Label>
              <RadioGroup
                value={stopDateOption || "ongoing"}
                onValueChange={(value) => {
                  setValue("stop_date_option", value as any);
                  
                  // Calculate stop_date based on option and start_date
                  if (startDate && value !== "ongoing") {
                    const start = new Date(startDate + "-01");
                    let stopDate: Date;
                    
                    if (value === "1-10-days") {
                      stopDate = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
                    } else { // 3-months
                      stopDate = new Date(start);
                      stopDate.setMonth(stopDate.getMonth() + 3);
                    }
                    
                    setValue("stop_date", stopDate.toISOString().split('T')[0]);
                  } else {
                    setValue("stop_date", "");
                  }
                }}
                disabled={isReadOnly}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="1-10-days" id="stop-1-10" />
                  <Label htmlFor="stop-1-10" className="font-normal cursor-pointer">
                    1-10 days from start
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3-months" id="stop-3-months" />
                  <Label htmlFor="stop-3-months" className="font-normal cursor-pointer">
                    3 months from start
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="ongoing" id="stop-ongoing" />
                  <Label htmlFor="stop-ongoing" className="font-normal cursor-pointer">
                    No set date (ongoing)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="condition_id">Associated Medical Condition</Label>
              <Select
                value={watch("condition_id") || ""}
                onValueChange={(value) => setValue("condition_id", value === "__none__" ? "" : value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a condition (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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
