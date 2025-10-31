import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";
import React from "react";

const pharmacySchema = z.object({
  pharmacy_name: z.string().min(1, "Pharmacy name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2, "State must be 2 characters"),
  zip_code: z.string().min(5, "ZIP code is required"),
  phone: z.string()
    .min(10, "Phone number must be 10 digits")
    .max(10, "Phone number must be 10 digits")
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits (e.g., 5618882222)"),
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
  
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<PharmacyFormData>({
    resolver: zodResolver(pharmacySchema),
    defaultValues: {
      pharmacy_name: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      is_preferred: false,
    },
  });

  // Update form values when pharmacy data changes
  React.useEffect(() => {
    if (pharmacy) {
      setValue("pharmacy_name", pharmacy.pharmacy_name || "");
      setValue("address", pharmacy.address || "");
      setValue("city", pharmacy.city || "");
      setValue("state", pharmacy.state || "");
      setValue("zip_code", pharmacy.zip_code || "");
      setValue("phone", pharmacy.phone || "");
      setValue("is_preferred", pharmacy.is_preferred || false);
    }
  }, [pharmacy, setValue]);

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
      onSuccess: () => {
        onOpenChange(false);
        if (mode === "add") {
          reset();
        }
      },
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

          <GoogleAddressAutocomplete
            label="Address"
            required
            value={{
              street: watch("address"),
              city: watch("city"),
              state: watch("state"),
              zip: watch("zip_code"),
            }}
            onChange={(address: AddressValue) => {
              if (address.street) setValue("address", address.street);
              if (address.city) setValue("city", address.city);
              if (address.state) setValue("state", address.state);
              if (address.zip) setValue("zip_code", address.zip);
            }}
            disabled={isReadOnly}
            placeholder="Start typing pharmacy address..."
          />
          {(errors.address || errors.city || errors.state || errors.zip_code) && (
            <p className="text-sm text-red-500">
              {errors.address?.message || errors.city?.message || errors.state?.message || errors.zip_code?.message}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="phone">Phone (10 digits) *</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="5618882222"
              maxLength={10}
              disabled={isReadOnly}
              className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && (
              <p className="text-sm text-red-500">{errors.phone.message}</p>
            )}
          </div>

          <div className="flex items-center space-x-2 p-4 bg-gray-900 rounded-lg border border-gray-700">
            <Checkbox
              id="is_preferred"
              checked={watch("is_preferred") || false}
              onCheckedChange={(checked) => setValue("is_preferred", checked as boolean)}
              disabled={isReadOnly}
              className="border-gray-600 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
            />
            <Label htmlFor="is_preferred" className="text-sm font-medium cursor-pointer text-gray-200">
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
