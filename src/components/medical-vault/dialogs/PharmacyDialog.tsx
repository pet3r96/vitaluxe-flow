import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";

const pharmacySchema = z.object({
  pharmacy_name: z.string().min(1, "Pharmacy name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2, "State must be 2 characters"),
  zip_code: z.string().min(5, "ZIP code is required"),
  phone: z.string().min(10, "Phone number is required"),
  is_preferred: z.boolean().optional(),
});

type PharmacyFormData = z.infer<typeof pharmacySchema>;

interface PharmacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  pharmacy?: any;
  mode: "add" | "edit" | "view";
}

export function PharmacyDialog({ open, onOpenChange, patientAccountId, pharmacy, mode }: PharmacyDialogProps) {
  const isReadOnly = mode === "view";
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<PharmacyFormData>({
    resolver: zodResolver(pharmacySchema),
    defaultValues: pharmacy || {
      pharmacy_name: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      is_preferred: false,
    },
  });

  const mutation = useOptimisticMutation(
    async (data: PharmacyFormData) => {
      const formattedData = {
        pharmacy_name: data.pharmacy_name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip_code: data.zip_code,
        phone: data.phone,
        is_preferred: data.is_preferred || false,
      };

      // If setting as preferred, first unset all other preferred pharmacies
      if (formattedData.is_preferred) {
        await supabase
          .from("patient_pharmacies")
          .update({ is_preferred: false })
          .eq("patient_account_id", patientAccountId);
      }

      if (mode === "edit" && pharmacy) {
        const { error } = await supabase
          .from("patient_pharmacies")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", pharmacy.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_pharmacies")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
          });
        if (error) throw error;
      }
    },
    {
      queryKey: ["patient-pharmacies", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === pharmacy.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID() }];
      },
      successMessage: mode === "edit" ? "Pharmacy updated successfully" : "Pharmacy added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} pharmacy`,
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: PharmacyFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Pharmacy" : mode === "edit" ? "Edit Pharmacy" : "View Pharmacy"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pharmacy_name">Pharmacy Name *</Label>
            <Input
              id="pharmacy_name"
              {...register("pharmacy_name")}
              placeholder="e.g., CVS Pharmacy, Walgreens"
              disabled={isReadOnly}
              className={errors.pharmacy_name ? "border-red-500" : ""}
            />
            {errors.pharmacy_name && (
              <p className="text-sm text-red-500">{errors.pharmacy_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 Main St"
              disabled={isReadOnly}
              className={errors.address ? "border-red-500" : ""}
            />
            {errors.address && (
              <p className="text-sm text-red-500">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                {...register("city")}
                placeholder="New York"
                disabled={isReadOnly}
                className={errors.city ? "border-red-500" : ""}
              />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">State *</Label>
              <Input
                id="state"
                {...register("state")}
                placeholder="NY"
                maxLength={2}
                disabled={isReadOnly}
                className={errors.state ? "border-red-500" : ""}
              />
              {errors.state && (
                <p className="text-sm text-red-500">{errors.state.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">ZIP Code *</Label>
              <Input
                id="zip_code"
                {...register("zip_code")}
                placeholder="10001"
                disabled={isReadOnly}
                className={errors.zip_code ? "border-red-500" : ""}
              />
              {errors.zip_code && (
                <p className="text-sm text-red-500">{errors.zip_code.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="(555) 123-4567"
              disabled={isReadOnly}
              className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <Checkbox
              id="is_preferred"
              checked={watch("is_preferred") || false}
              onCheckedChange={(checked) => setValue("is_preferred", checked as boolean)}
              disabled={isReadOnly}
            />
            <Label htmlFor="is_preferred" className="text-sm font-medium cursor-pointer">
              Mark as Preferred Pharmacy
            </Label>
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
                className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Pharmacy
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
