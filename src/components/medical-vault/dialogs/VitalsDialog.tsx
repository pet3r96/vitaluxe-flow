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
import { useQueryClient } from "@tanstack/react-query";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";

const vitalsSchema = z.object({
  vital_type: z.string().optional(),
  height: z.string().optional().refine((val) => {
    if (!val) return true;
    // Allow formats: 5-5, 5'5, 5'5", 6-0, 6'0, 70 (inches), 170 (cm)
    const formats = [
      /^\d+[-']\d+["']?$/,  // 5-5, 5'5, 5'5", 6-0, 6'0
      /^\d+(\.\d+)?$/        // 70, 70.5, 170
    ];
    return formats.some(regex => regex.test(val.trim()));
  }, { message: "Invalid height format. Use: 5-5, 5'5, or 70" }),
  height_unit: z.string().optional(),
  weight: z.string().optional(),
  weight_unit: z.string().optional(),
  blood_pressure_systolic: z.string().optional(),
  blood_pressure_diastolic: z.string().optional(),
  pulse: z.string().optional(),
  temperature: z.string().optional(),
  temperature_unit: z.string().optional(),
  oxygen_saturation: z.string().optional(),
  cholesterol: z.string().optional(),
  blood_sugar: z.string().optional(),
  date_recorded: z.string().min(1, "Date is required"),
});

type VitalsFormData = z.infer<typeof vitalsSchema>;

interface VitalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  vitals?: any;
  mode: "add" | "edit" | "view" | "add-basic" | "add-timeseries";
  basicVitalType?: "height" | "weight" | null;
}

export function VitalsDialog({ open, onOpenChange, patientAccountId, vitals, mode, basicVitalType }: VitalsDialogProps) {
  const isReadOnly = mode === "view";
  const isBasicVitalMode = mode === "add-basic";
  const isTimeSeriesMode = mode === "add-timeseries";
  const { effectiveUserId, effectiveRole } = useAuth();
  
  // Helper to format height for display in input (convert stored inches to feet-inches)
  const formatHeightForInput = (height: number | undefined, unit: string | undefined): string => {
    if (!height) return "";
    if (unit === 'in' && height >= 12) {
      const feet = Math.floor(height / 12);
      const inches = Math.round(height % 12);
      return `${feet}-${inches}`;
    }
    return height.toString();
  };
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<VitalsFormData>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: vitals ? {
      vital_type: vitals.vital_type,
      height: formatHeightForInput(vitals.height, vitals.height_unit),
      height_unit: vitals.height_unit || "in",
      weight: vitals.weight?.toString() || "",
      weight_unit: vitals.weight_unit || "lbs",
      blood_pressure_systolic: vitals.blood_pressure_systolic?.toString() || "",
      blood_pressure_diastolic: vitals.blood_pressure_diastolic?.toString() || "",
      pulse: vitals.pulse?.toString() || "",
      temperature: vitals.temperature?.toString() || "",
      temperature_unit: vitals.temperature_unit || "F",
      oxygen_saturation: vitals.oxygen_saturation?.toString() || "",
      cholesterol: vitals.cholesterol?.toString() || "",
      blood_sugar: vitals.blood_sugar?.toString() || "",
      date_recorded: vitals.date_recorded?.substring(0, 7) || new Date().toISOString().substring(0, 7),
    } : {
      vital_type: isBasicVitalMode ? basicVitalType || "" : "",
      height: "",
      height_unit: "in",
      weight: "",
      weight_unit: "lbs",
      blood_pressure_systolic: "",
      blood_pressure_diastolic: "",
      pulse: "",
      temperature: "",
      temperature_unit: "F",
      oxygen_saturation: "",
      cholesterol: "",
      blood_sugar: "",
      date_recorded: new Date().toISOString().substring(0, 7),
    },
  });

  const selectedVitalType = watch("vital_type");
  const height = watch("height");
  const weight = watch("weight");

  // Set vital type for basic vital mode
  useEffect(() => {
    if (isBasicVitalMode && basicVitalType) {
      setValue("vital_type", basicVitalType);
    }
  }, [isBasicVitalMode, basicVitalType, setValue]);

  const queryClient = useQueryClient();

  const mutation = useOptimisticMutation(
    async (data: VitalsFormData) => {
      const vitalType = data.vital_type || vitals?.vital_type;
      
      // Convert YYYY-MM to YYYY-MM-01 for database storage
      const fullDate = data.date_recorded ? data.date_recorded + "-01" : new Date().toISOString().substring(0, 7) + "-01";

      // Helper function to parse height formats
      const parseHeight = (heightStr: string, unit: string): number | null => {
        if (!heightStr) return null;
        
        const trimmed = heightStr.trim();
        
        // Check if it's in feet-inches format (5-5, 5'5, 5'5")
        const feetInchesMatch = trimmed.match(/^(\d+)[-'](\d+)["']?$/);
        if (feetInchesMatch) {
          const feet = parseInt(feetInchesMatch[1]);
          const inches = parseInt(feetInchesMatch[2]);
          const totalInches = (feet * 12) + inches;
          
          // If unit is cm, convert inches to cm
          if (unit === 'cm') {
            return totalInches * 2.54;
          }
          return totalInches;
        }
        
        // Otherwise, parse as decimal number
        const num = parseFloat(trimmed);
        return isNaN(num) ? null : num;
      };

      // Build the data object based on vital type
      const formattedData: any = {
        vital_type: vitalType,
        date_recorded: fullDate,
      };

      // Add fields based on vital type
      if (vitalType === 'height') {
        formattedData.height = parseHeight(data.height || "", data.height_unit || "in");
        formattedData.height_unit = data.height_unit || null;
      } else if (vitalType === 'weight') {
        formattedData.weight = data.weight ? parseFloat(data.weight) : null;
        formattedData.weight_unit = data.weight_unit || null;
      } else if (vitalType === 'blood_pressure') {
        formattedData.blood_pressure_systolic = data.blood_pressure_systolic ? parseInt(data.blood_pressure_systolic) : null;
        formattedData.blood_pressure_diastolic = data.blood_pressure_diastolic ? parseInt(data.blood_pressure_diastolic) : null;
      } else if (vitalType === 'pulse') {
        formattedData.pulse = data.pulse ? parseInt(data.pulse) : null;
      } else if (vitalType === 'temperature') {
        formattedData.temperature = data.temperature ? parseFloat(data.temperature) : null;
        formattedData.temperature_unit = data.temperature_unit || null;
      } else if (vitalType === 'oxygen_saturation') {
        formattedData.oxygen_saturation = data.oxygen_saturation ? parseInt(data.oxygen_saturation) : null;
      } else if (vitalType === 'cholesterol') {
        formattedData.cholesterol = data.cholesterol ? parseInt(data.cholesterol) : null;
      } else if (vitalType === 'blood_sugar') {
        formattedData.blood_sugar = data.blood_sugar ? parseInt(data.blood_sugar) : null;
      }

      if (mode === "edit" && vitals) {
        const { error } = await supabase
          .from("patient_vitals")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", vitals.id);
        if (error) throw error;
      } else if (isBasicVitalMode && vitals) {
        // Update existing height/weight record
        const { error } = await supabase
          .from("patient_vitals")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", vitals.id);
        if (error) throw error;
      } else {
        // Insert new record
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
        if (mode === "edit" || (isBasicVitalMode && vitals)) {
          return oldData?.map((item: any) =>
            item.id === vitals.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID() }];
      },
      successMessage: mode === "edit" || (isBasicVitalMode && vitals) ? "Vitals updated successfully" : "Vitals added successfully",
      errorMessage: `Failed to ${mode === "edit" || (isBasicVitalMode && vitals) ? "update" : "add"} vitals`,
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: ["patient-medical-vault-status"] });
        
        // Log audit trail
        const formData = watch();
        const vitalType = formData.vital_type || vitals?.vital_type;
        const entityName = vitalType ? `${vitalType.replace(/_/g, ' ')}` : "vitals";
        
        await logMedicalVaultChange({
          patientAccountId,
          actionType: mode === "edit" || (isBasicVitalMode && vitals) ? "updated" : "created",
          entityType: "vital",
          entityId: vitals?.id,
          entityName: entityName,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: mode === "edit" || (isBasicVitalMode && vitals) ? vitals : undefined,
          newData: formData,
          changeSummary: mode === "edit" || (isBasicVitalMode && vitals)
            ? `Updated ${entityName}` 
            : `Added new ${entityName}`
        });
        
        onOpenChange(false);
      },
    }
  );

  const onSubmit = (data: VitalsFormData) => {
    mutation.mutate(data);
  };

  const getDialogTitle = () => {
    if (mode === "view") return "View Vitals";
    if (isBasicVitalMode) {
      if (vitals) {
        return `Edit ${basicVitalType === 'height' ? 'Height' : 'Weight'}`;
      }
      return `Add ${basicVitalType === 'height' ? 'Height' : 'Weight'}`;
    }
    if (mode === "edit") return "Edit Vitals";
    return "Add Vitals";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
            {getDialogTitle()}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Vital Type Selector for add-timeseries mode */}
          {isTimeSeriesMode && (
            <div className="space-y-2">
              <Label htmlFor="vital_type">Vital Type *</Label>
              <Select
                value={selectedVitalType || ""}
                onValueChange={(value) => setValue("vital_type", value)}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vital type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blood_pressure">Blood Pressure</SelectItem>
                  <SelectItem value="pulse">Pulse</SelectItem>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="oxygen_saturation">Oxygen Saturation</SelectItem>
                  <SelectItem value="cholesterol">Cholesterol</SelectItem>
                  <SelectItem value="blood_sugar">Blood Sugar</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Date Input - Month/Year for time-series, hidden for basic vitals */}
          {!isBasicVitalMode && (
            <div className="space-y-2">
              <Label htmlFor="date_recorded">Date Recorded (Month / Year) *</Label>
              <Input
                id="date_recorded"
                type="month"
                {...register("date_recorded")}
                disabled={isReadOnly}
                className={errors.date_recorded ? "border-red-500" : ""}
              />
              {errors.date_recorded && (
                <p className="text-sm text-red-500">{errors.date_recorded.message}</p>
              )}
            </div>
          )}

          {/* Dynamic Fields Based on Vital Type */}
          {(isBasicVitalMode ? basicVitalType === 'height' : selectedVitalType === 'height' || (!isTimeSeriesMode && vitals?.height)) && (
            <div className="space-y-2">
              <Label htmlFor="height">Height *</Label>
              <div className="flex gap-2">
                <Input
                  id="height"
                  {...register("height")}
                  placeholder="5-5, 5'5, or 70"
                  disabled={isReadOnly}
                />
                <Select
                  value={watch("height_unit") || "in"}
                  onValueChange={(value) => setValue("height_unit", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">in</SelectItem>
                    <SelectItem value="cm">cm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Examples: 5-5, 5'5, 6-0, or 70</p>
              {errors.height && (
                <p className="text-sm text-red-500">{errors.height.message}</p>
              )}
            </div>
          )}

          {(isBasicVitalMode ? basicVitalType === 'weight' : selectedVitalType === 'weight' || (!isTimeSeriesMode && vitals?.weight)) && (
            <div className="space-y-2">
              <Label htmlFor="weight">Weight *</Label>
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
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lbs">lbs</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(selectedVitalType === 'blood_pressure' || (!isTimeSeriesMode && !isBasicVitalMode && vitals?.blood_pressure_systolic)) && (
            <div className="space-y-2">
              <Label htmlFor="blood_pressure_systolic">Blood Pressure *</Label>
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
          )}

          {(selectedVitalType === 'pulse' || (!isTimeSeriesMode && !isBasicVitalMode && vitals?.pulse)) && (
            <div className="space-y-2">
              <Label htmlFor="pulse">Pulse *</Label>
              <Input
                id="pulse"
                {...register("pulse")}
                placeholder="72"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">bpm</p>
            </div>
          )}

          {(selectedVitalType === 'temperature' || (!isTimeSeriesMode && !isBasicVitalMode && vitals?.temperature)) && (
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature *</Label>
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
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">°F</SelectItem>
                    <SelectItem value="C">°C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(selectedVitalType === 'oxygen_saturation' || (!isTimeSeriesMode && !isBasicVitalMode && vitals?.oxygen_saturation)) && (
            <div className="space-y-2">
              <Label htmlFor="oxygen_saturation">Oxygen Saturation *</Label>
              <Input
                id="oxygen_saturation"
                {...register("oxygen_saturation")}
                placeholder="98"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">%</p>
            </div>
          )}

          {(selectedVitalType === 'cholesterol' || (!isTimeSeriesMode && !isBasicVitalMode && vitals?.cholesterol)) && (
            <div className="space-y-2">
              <Label htmlFor="cholesterol">Cholesterol *</Label>
              <Input
                id="cholesterol"
                {...register("cholesterol")}
                placeholder="200"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">mg/dL</p>
            </div>
          )}

          {(selectedVitalType === 'blood_sugar' || (!isTimeSeriesMode && !isBasicVitalMode && vitals?.blood_sugar)) && (
            <div className="space-y-2">
              <Label htmlFor="blood_sugar">Blood Sugar *</Label>
              <Input
                id="blood_sugar"
                {...register("blood_sugar")}
                placeholder="100"
                disabled={isReadOnly}
                type="number"
              />
              <p className="text-xs text-muted-foreground">mg/dL</p>
            </div>
          )}

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
                {mode === "edit" || (isBasicVitalMode && vitals) ? "Update" : "Add"} Vitals
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
