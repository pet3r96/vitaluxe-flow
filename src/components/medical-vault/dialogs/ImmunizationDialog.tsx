import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";
import { searchVaccines } from "@/lib/medical-api-service";
import { useQueryClient } from "@tanstack/react-query";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";

const immunizationSchema = z.object({
  vaccine_name: z.string().min(1, "Vaccine name is required"),
  date_administered: z.string().min(1, "Date administered is required"),
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
  const { effectiveUserId, effectiveRole, user } = useAuth();
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<ImmunizationFormData>({
    resolver: zodResolver(immunizationSchema),
    defaultValues: immunization || {
      vaccine_name: "",
      date_administered: "",
    },
  });

  const queryClient = useQueryClient();

  const mutation = useOptimisticMutation(
    async (data: ImmunizationFormData) => {
      // Get authenticated user directly from Supabase auth (matches RLS auth.uid())
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");
      
      console.log('[ImmunizationDialog] Auth check:', {
        authUserId: authUser.id,
        patientAccountId,
        mode,
      });
      
      const formattedData = {
        vaccine_name: data.vaccine_name,
        date_administered: `${data.date_administered}-01`, // Convert YYYY-MM to YYYY-MM-01
        lot_number: null,
        administering_provider: null,
        notes: null,
      };

      if (mode === "edit" && immunization) {
        const { error } = await supabase
          .from("patient_immunizations")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", immunization.id);
        
        if (error) {
          console.error('[ImmunizationDialog] UPDATE failed:', error.message);
          throw error;
        }
        console.log('[ImmunizationDialog] UPDATE success');
      } else {
        const { error } = await supabase
          .from("patient_immunizations")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
            added_by_user_id: authUser.id, // Use auth.uid() directly - matches RLS policy
            added_by_role: mapRoleToAuditRole(effectiveRole),
          });
        
        if (error) {
          console.error('[ImmunizationDialog] INSERT failed:', {
            error: error.message,
            authUserId: authUser.id,
            patientAccountId,
          });
          throw error;
        }
        console.log('[ImmunizationDialog] INSERT success');
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
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: ["patient-medical-vault-status"] });
        
        // Log audit trail
        await logMedicalVaultChange({
          patientAccountId,
          actionType: mode === "edit" ? "updated" : "created",
          entityType: "immunization",
          entityId: immunization?.id,
          entityName: watch("vaccine_name"),
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: mode === "edit" ? immunization : undefined,
          newData: watch(),
          changeSummary: mode === "edit" 
            ? `Updated immunization: ${watch("vaccine_name")}` 
            : `Added new immunization: ${watch("vaccine_name")}`
        });
        
        onOpenChange(false);
        if (mode === "add") {
          reset();
        }
      },
    }
  );

  const onSubmit = (data: ImmunizationFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-card dark:bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Immunization" : mode === "edit" ? "Edit Immunization" : "View Immunization"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vaccine_name">Vaccine Name *</Label>
              <AutocompleteInput
                id="vaccine_name"
                value={watch("vaccine_name") || ""}
                onChange={(value) => setValue("vaccine_name", value)}
                onSearch={searchVaccines}
                placeholder="Start typing vaccine name..."
                disabled={isReadOnly}
                className={errors.vaccine_name ? "border-red-500" : ""}
              />
              {errors.vaccine_name && (
                <p className="text-sm text-red-500">{errors.vaccine_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_administered">Date Administered (Month/Year) *</Label>
              <Input
                id="date_administered"
                type="month"
                {...register("date_administered")}
                disabled={isReadOnly}
                className={errors.date_administered ? "border-red-500" : ""}
              />
              {errors.date_administered && (
                <p className="text-sm text-red-500">{errors.date_administered.message}</p>
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
