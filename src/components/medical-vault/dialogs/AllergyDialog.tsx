import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

const allergySchema = z.object({
  nka: z.boolean().optional(),
  allergen_name: z.string().optional(),
  reaction_type: z.string().optional(),
  severity: z.enum(["mild", "moderate", "severe"]).optional(),
  date_recorded: z.string().optional().refine(
    (val) => !val || /^\d{4}-\d{2}$/.test(val),
    "Date recorded must be in YYYY-MM format"
  ),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.nka) return true;
  return data.allergen_name && data.allergen_name.length > 0;
}, {
  message: "Allergen name is required when NKA is not checked",
  path: ["allergen_name"],
});

type AllergyFormData = z.infer<typeof allergySchema>;

interface AllergyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  allergy?: any;
  mode: "add" | "edit" | "view";
}

export function AllergyDialog({ open, onOpenChange, patientAccountId, allergy, mode }: AllergyDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<AllergyFormData>({
    resolver: zodResolver(allergySchema),
    defaultValues: {
      nka: false,
      allergen_name: "",
      reaction_type: "",
      severity: undefined,
      date_recorded: new Date().toISOString().substring(0, 7),
      notes: "",
    },
  });

  const nkaChecked = watch("nka");

  // Handle edit mode - convert existing date to month format
  useEffect(() => {
    if (allergy && open) {
      // Convert date_recorded from YYYY-MM-DD to YYYY-MM
      const monthYear = allergy.date_recorded ? allergy.date_recorded.substring(0, 7) : "";
      
      reset({
        nka: allergy.nka || false,
        allergen_name: allergy.allergen_name || "",
        reaction_type: allergy.reaction_type || "",
        severity: allergy.severity || undefined,
        date_recorded: monthYear,
        notes: allergy.notes || "",
      });
    } else if (!allergy && open) {
      reset({
        nka: false,
        allergen_name: "",
        reaction_type: "",
        severity: undefined,
        date_recorded: new Date().toISOString().substring(0, 7),
        notes: "",
      });
    }
  }, [allergy, open, reset]);

  // Clear other fields when NKA is checked
  useEffect(() => {
    if (nkaChecked) {
      setValue("allergen_name", "");
      setValue("reaction_type", "");
      setValue("severity", undefined);
    }
  }, [nkaChecked, setValue]);

  const mutation = useOptimisticMutation(
    async (data: AllergyFormData) => {
      // Check for conflicts before submission
      const { data: existingAllergies } = await supabase
        .from("patient_allergies")
        .select("id, nka")
        .eq("patient_account_id", patientAccountId)
        .eq("is_active", true);

      // If adding NKA, check for existing specific allergies
      if (data.nka) {
        const hasSpecificAllergies = existingAllergies?.some(a => 
          !a.nka && (mode !== "edit" || a.id !== allergy?.id)
        );
        if (hasSpecificAllergies) {
          throw new Error("Cannot mark as NKA while specific allergies exist. Please remove them first.");
        }
      } else {
        // If adding specific allergy, check for existing NKA
        const hasNKA = existingAllergies?.some(a => 
          a.nka && (mode !== "edit" || a.id !== allergy?.id)
        );
        if (hasNKA) {
          throw new Error("Cannot add specific allergies while NKA is marked. Please remove NKA first.");
        }
      }

      // Convert YYYY-MM to YYYY-MM-01 for database storage
      const fullDate = data.date_recorded ? data.date_recorded + "-01" : new Date().toISOString().substring(0, 7) + "-01";
      
      const formattedData = {
        nka: data.nka || false,
        allergen_name: data.allergen_name || null,
        reaction_type: data.reaction_type || null,
        severity: data.severity || null,
        date_recorded: fullDate,
        notes: data.notes || null,
      };

      if (mode === "edit" && allergy) {
        const { error } = await supabase
          .from("patient_allergies")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", allergy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_allergies")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
            is_active: true,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-allergies", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === allergy.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID(), is_active: true }];
      },
      successMessage: mode === "edit" ? "Allergy updated successfully" : "Allergy added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} allergy`,
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: AllergyFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Allergy" : mode === "edit" ? "Edit Allergy" : "View Allergy"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex items-center space-x-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <Checkbox
              id="nka"
              checked={nkaChecked || false}
              onCheckedChange={(checked) => setValue("nka", checked as boolean)}
              disabled={isReadOnly}
              className="border-gray-600 data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
            />
            <Label htmlFor="nka" className="text-sm font-medium cursor-pointer text-gray-200">
              NKA (No Known Allergies)
            </Label>
          </div>

          {!nkaChecked && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="allergen_name">Allergen Name *</Label>
                  <Input
                    id="allergen_name"
                    {...register("allergen_name")}
                    placeholder="e.g., Penicillin, Peanuts"
                    disabled={isReadOnly}
                    className={errors.allergen_name ? "border-red-500" : ""}
                  />
                  {errors.allergen_name && (
                    <p className="text-sm text-red-500">{errors.allergen_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reaction_type">Reaction Type</Label>
                  <Input
                    id="reaction_type"
                    {...register("reaction_type")}
                    placeholder="e.g., Rash, Anaphylaxis"
                    disabled={isReadOnly}
                  />
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

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="date_recorded">Date Recorded (Month & Year)</Label>
                  <Input
                    id="date_recorded"
                    type="month"
                    {...register("date_recorded")}
                    disabled={isReadOnly}
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional information about the allergy"
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
                className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Allergy
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
