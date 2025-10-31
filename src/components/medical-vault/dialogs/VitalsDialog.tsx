import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const vitalsSchema = z.object({
  height: z.string().optional(),
  height_unit: z.string().optional(),
  weight: z.string().optional(),
  weight_unit: z.string().optional(),
  bmi: z.string().optional(),
  blood_pressure_systolic: z.string().optional(),
  blood_pressure_diastolic: z.string().optional(),
  pulse: z.string().optional(),
  temperature: z.string().optional(),
  temperature_unit: z.string().optional(),
  oxygen_saturation: z.string().optional(),
  cholesterol: z.string().optional(),
  blood_sugar: z.string().optional(),
  date_recorded: z.string().min(1, "Date recorded is required"),
});

type VitalsFormData = z.infer<typeof vitalsSchema>;

interface VitalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  vitals?: any;
  mode: "add" | "edit" | "view";
}

export function VitalsDialog({ open, onOpenChange, patientAccountId, vitals, mode }: VitalsDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<VitalsFormData>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: vitals || {
      height: "",
      height_unit: "in",
      weight: "",
      weight_unit: "lbs",
      bmi: "",
      blood_pressure_systolic: "",
      blood_pressure_diastolic: "",
      pulse: "",
      temperature: "",
      temperature_unit: "F",
      oxygen_saturation: "",
      cholesterol: "",
      blood_sugar: "",
      date_recorded: new Date().toISOString().split('T')[0],
    },
  });

  const height = watch("height");
  const weight = watch("weight");
  const heightUnit = watch("height_unit");
  const weightUnit = watch("weight_unit");

  // Auto-calculate BMI
  useEffect(() => {
    if (height && weight) {
      const heightValue = parseFloat(height);
      const weightValue = parseFloat(weight);
      
      if (!isNaN(heightValue) && !isNaN(weightValue) && heightValue > 0) {
        let bmi: number;
        
        // Convert to standard units (inches and lbs) if needed
        const heightInches = heightUnit === "cm" ? heightValue / 2.54 : heightValue;
        const weightLbs = weightUnit === "kg" ? weightValue * 2.20462 : weightValue;
        
        // BMI = (weight in lbs / (height in inches)²) × 703
        bmi = (weightLbs / (heightInches * heightInches)) * 703;
        
        setValue("bmi", bmi.toFixed(1));
      }
    }
  }, [height, weight, heightUnit, weightUnit, setValue]);

  const mutation = useOptimisticMutation(
    async (data: VitalsFormData) => {
      // Convert string values to numbers for database
      const formattedData = {
        height: data.height ? parseFloat(data.height) : null,
        height_unit: data.height_unit || null,
        weight: data.weight ? parseFloat(data.weight) : null,
        weight_unit: data.weight_unit || null,
        bmi: data.bmi ? parseFloat(data.bmi) : null,
        blood_pressure_systolic: data.blood_pressure_systolic ? parseInt(data.blood_pressure_systolic) : null,
        blood_pressure_diastolic: data.blood_pressure_diastolic ? parseInt(data.blood_pressure_diastolic) : null,
        pulse: data.pulse ? parseInt(data.pulse) : null,
        temperature: data.temperature ? parseFloat(data.temperature) : null,
        temperature_unit: data.temperature_unit || null,
        oxygen_saturation: data.oxygen_saturation ? parseInt(data.oxygen_saturation) : null,
        cholesterol: data.cholesterol ? parseInt(data.cholesterol) : null,
        blood_sugar: data.blood_sugar ? parseInt(data.blood_sugar) : null,
        date_recorded: data.date_recorded,
      };

      if (mode === "edit" && vitals) {
        const { error } = await supabase
          .from("patient_vitals")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", vitals.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_vitals")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-vitals", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === vitals.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID() }];
      },
      successMessage: mode === "edit" ? "Vitals updated successfully" : "Vitals added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} vitals`,
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: VitalsFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Vitals" : mode === "edit" ? "Edit Vitals" : "View Vitals"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="date_recorded">Date / Time Recorded *</Label>
            <Input
              id="date_recorded"
              type="date"
              {...register("date_recorded")}
              disabled={isReadOnly}
              className={errors.date_recorded ? "border-red-500" : ""}
            />
            {errors.date_recorded && (
              <p className="text-sm text-red-500">{errors.date_recorded.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="height">Height</Label>
              <div className="flex gap-2">
                <Input
                  id="height"
                  {...register("height")}
                  placeholder="70"
                  disabled={isReadOnly}
                  type="number"
                  step="0.1"
                />
                <Select
                  value={watch("height_unit") || "in"}
                  onValueChange={(value) => setValue("height_unit", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <div className="flex gap-2">
                <Input
                  id="weight"
                  {...register("weight")}
                  placeholder="150"
                  disabled={isReadOnly}
                  type="number"
                  step="0.1"
                />
                <Select
                  value={watch("weight_unit") || "lbs"}
                  onValueChange={(value) => setValue("weight_unit", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs">lbs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bmi">BMI (Auto-calculated)</Label>
              <Input
                id="bmi"
                {...register("bmi")}
                disabled
                placeholder="--"
                className="bg-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="blood_pressure_systolic">Blood Pressure</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="blood_pressure_systolic"
                  {...register("blood_pressure_systolic")}
                  placeholder="120"
                  disabled={isReadOnly}
                  type="number"
                />
                <span>/</span>
                <Input
                  id="blood_pressure_diastolic"
                  {...register("blood_pressure_diastolic")}
                  placeholder="80"
                  disabled={isReadOnly}
                  type="number"
                />
              </div>
              <p className="text-xs text-muted-foreground">mmHg (Systolic/Diastolic)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pulse">Pulse</Label>
              <Input
                id="pulse"
                {...register("pulse")}
                placeholder="72"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">bpm</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <div className="flex gap-2">
                <Input
                  id="temperature"
                  {...register("temperature")}
                  placeholder="98.6"
                  disabled={isReadOnly}
                  type="number"
                  step="0.1"
                />
                <Select
                  value={watch("temperature_unit") || "F"}
                  onValueChange={(value) => setValue("temperature_unit", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">°F</SelectItem>
                    <SelectItem value="C">°C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="oxygen_saturation">Oxygen Saturation</Label>
              <Input
                id="oxygen_saturation"
                {...register("oxygen_saturation")}
                placeholder="98"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">%</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cholesterol">Cholesterol</Label>
              <Input
                id="cholesterol"
                {...register("cholesterol")}
                placeholder="200"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">mg/dL</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="blood_sugar">Blood Sugar</Label>
              <Input
                id="blood_sugar"
                {...register("blood_sugar")}
                placeholder="100"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">mg/dL</p>
            </div>
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
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Vitals
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
