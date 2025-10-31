import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";

const surgerySchema = z.object({
  surgery_type: z.string().min(1, "Surgery type is required"),
  surgery_date: z.string().min(1, "Surgery date is required"),
  surgeon_name: z.string().optional(),
  hospital: z.string().optional(),
  notes: z.string().optional(),
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
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SurgeryFormData>({
    resolver: zodResolver(surgerySchema),
    defaultValues: surgery || {
      surgery_type: "",
      surgery_date: "",
      surgeon_name: "",
      hospital: "",
      notes: "",
    },
  });

  const mutation = useOptimisticMutation(
    async (data: SurgeryFormData) => {
      const formattedData = {
        surgery_type: data.surgery_type,
        surgery_date: data.surgery_date,
        surgeon_name: data.surgeon_name || null,
        hospital: data.hospital || null,
        notes: data.notes || null,
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
      onSuccess: () => onOpenChange(false),
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="surgery_type">Surgery Type *</Label>
              <Input
                id="surgery_type"
                {...register("surgery_type")}
                placeholder="e.g., Appendectomy, Knee Replacement"
                disabled={isReadOnly}
                className={errors.surgery_type ? "border-red-500" : ""}
              />
              {errors.surgery_type && (
                <p className="text-sm text-red-500">{errors.surgery_type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="surgery_date">Surgery Date *</Label>
              <Input
                id="surgery_date"
                type="date"
                {...register("surgery_date")}
                disabled={isReadOnly}
                className={errors.surgery_date ? "border-red-500" : ""}
              />
              {errors.surgery_date && (
                <p className="text-sm text-red-500">{errors.surgery_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="surgeon_name">Surgeon Name</Label>
              <Input
                id="surgeon_name"
                {...register("surgeon_name")}
                placeholder="e.g., Dr. Johnson"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="hospital">Hospital / Facility</Label>
              <Input
                id="hospital"
                {...register("hospital")}
                placeholder="e.g., Memorial Hospital"
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional details about the surgery"
              disabled={isReadOnly}
              rows={4}
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
