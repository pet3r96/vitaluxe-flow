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

const immunizationSchema = z.object({
  vaccine_name: z.string().min(1, "Vaccine name is required"),
  date_administered: z.string().min(1, "Date administered is required"),
  lot_number: z.string().optional(),
  administering_provider: z.string().optional(),
  notes: z.string().optional(),
});

type ImmunizationFormData = z.infer<typeof immunizationSchema>;

interface ImmunizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  immunization?: any;
  mode: "add" | "edit" | "view";
}

export function ImmunizationDialog({ open, onOpenChange, patientAccountId, immunization, mode }: ImmunizationDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ImmunizationFormData>({
    resolver: zodResolver(immunizationSchema),
    defaultValues: immunization || {
      vaccine_name: "",
      date_administered: "",
      lot_number: "",
      administering_provider: "",
      notes: "",
    },
  });

  const mutation = useOptimisticMutation(
    async (data: ImmunizationFormData) => {
      const formattedData = {
        vaccine_name: data.vaccine_name,
        date_administered: data.date_administered,
        lot_number: data.lot_number || null,
        administering_provider: data.administering_provider || null,
        notes: data.notes || null,
      };

      if (mode === "edit" && immunization) {
        const { error } = await supabase
          .from("patient_immunizations")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", immunization.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_immunizations")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-immunizations", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === immunization.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID() }];
      },
      successMessage: mode === "edit" ? "Immunization updated successfully" : "Immunization added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} immunization`,
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: ImmunizationFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Immunization" : mode === "edit" ? "Edit Immunization" : "View Immunization"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="vaccine_name">Vaccine Name *</Label>
              <Input
                id="vaccine_name"
                {...register("vaccine_name")}
                placeholder="e.g., COVID-19 Pfizer, Flu Shot"
                disabled={isReadOnly}
                className={errors.vaccine_name ? "border-red-500" : ""}
              />
              {errors.vaccine_name && (
                <p className="text-sm text-red-500">{errors.vaccine_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_administered">Date Administered *</Label>
              <Input
                id="date_administered"
                type="date"
                {...register("date_administered")}
                disabled={isReadOnly}
                className={errors.date_administered ? "border-red-500" : ""}
              />
              {errors.date_administered && (
                <p className="text-sm text-red-500">{errors.date_administered.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lot_number">Lot Number</Label>
              <Input
                id="lot_number"
                {...register("lot_number")}
                placeholder="e.g., ABC123"
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="administering_provider">Administering Provider</Label>
              <Input
                id="administering_provider"
                {...register("administering_provider")}
                placeholder="e.g., Dr. Smith, CVS Pharmacy"
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Additional information about this immunization"
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
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Immunization
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
