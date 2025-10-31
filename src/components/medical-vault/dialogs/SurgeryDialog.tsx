import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { searchSurgeries } from "@/lib/medical-api-service";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";

const surgerySchema = z.object({
  surgery_type: z.string().min(1, "Surgery type is required"),
  surgery_date: z.string().min(1, "Surgery date is required"),
});

type SurgeryFormData = z.infer<typeof surgerySchema>;

interface SurgeryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  surgery?: any;
  mode: "add" | "edit" | "view";
}

export function SurgeryDialog({ open, onOpenChange, patientAccountId, surgery, mode }: SurgeryDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<SurgeryFormData>({
    resolver: zodResolver(surgerySchema),
    defaultValues: surgery || {
      surgery_type: "",
      surgery_date: "",
    },
  });

  const mutation = useOptimisticMutation(
    async (data: SurgeryFormData) => {
      const formattedData = {
        surgery_type: data.surgery_type,
        surgery_date: `${data.surgery_date}-01`, // Convert YYYY-MM to YYYY-MM-01
        surgeon_name: null,
        hospital: null,
        notes: null,
      };

      if (mode === "edit" && surgery) {
        const { error } = await supabase
          .from("patient_surgeries")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", surgery.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_surgeries")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-surgeries", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === surgery.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID() }];
      },
      successMessage: mode === "edit" ? "Surgery updated successfully" : "Surgery added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} surgery`,
      onSuccess: () => {
        onOpenChange(false);
        if (mode === "add") {
          reset();
        }
      },
    }
  );

  const onSubmit = (data: SurgeryFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Surgery" : mode === "edit" ? "Edit Surgery" : "View Surgery"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="surgery_type">Past Surgery Type *</Label>
              <AutocompleteInput
                id="surgery_type"
                value={watch("surgery_type") || ""}
                onChange={(value) => setValue("surgery_type", value)}
                onSearch={searchSurgeries}
                placeholder="e.g., Appendectomy, Knee Replacement"
                disabled={isReadOnly}
                className={errors.surgery_type ? "border-red-500" : ""}
              />
              {errors.surgery_type && (
                <p className="text-sm text-red-500">{errors.surgery_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="surgery_date">Surgery Date (Month/Year) *</Label>
              <Input
                id="surgery_date"
                type="month"
                {...register("surgery_date")}
                disabled={isReadOnly}
                className={errors.surgery_date ? "border-red-500" : ""}
              />
              {errors.surgery_date && (
                <p className="text-sm text-red-500">{errors.surgery_date.message}</p>
              )}
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
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Surgery
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
