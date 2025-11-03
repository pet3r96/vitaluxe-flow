import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";
import { phoneSchema } from "@/lib/validators";
import { useQueryClient } from "@tanstack/react-query";
import { logMedicalVaultChange, mapRoleToAuditRole } from "@/hooks/useAuditLogs";
import { useAuth } from "@/contexts/AuthContext";

const emergencyContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  relationship: z.string().trim().min(1, "Relationship is required").max(50, "Relationship must be less than 50 characters"),
  phone: z.string().trim().length(10, "Phone number must be exactly 10 digits").regex(/^\d{10}$/, "Phone number must contain only numbers"),
  email: z.string().trim().email("Invalid email address").max(255, "Email must be less than 255 characters").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Address must be less than 500 characters").optional().or(z.literal("")),
  preferred_contact_method: z.enum(['phone', 'sms', 'email', 'any']).default('any'),
});

type EmergencyContactFormData = z.infer<typeof emergencyContactSchema>;

interface EmergencyContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientAccountId: string;
  contact?: any;
  mode: "add" | "edit" | "view";
}

export function EmergencyContactDialog({ open, onOpenChange, patientAccountId, contact, mode }: EmergencyContactDialogProps) {
  const isReadOnly = mode === "view";
  const { effectiveUserId, effectiveRole } = useAuth();
  
  const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset, watch } = useForm<EmergencyContactFormData>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: contact || {
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
      preferred_contact_method: "any",
    },
  });

  const queryClient = useQueryClient();

  const mutation = useOptimisticMutation(
    async (data: EmergencyContactFormData) => {
      const formattedData = {
        name: data.name,
        relationship: data.relationship,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        preferred_contact_method: data.preferred_contact_method,
      };

      if (mode === "edit" && contact) {
        const { error } = await supabase
          .from("patient_emergency_contacts")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", contact.id);
        if (error) throw error;
        // Success! No need to verify with SELECT - RLS may block read-after-write
      } else {
        const { error } = await supabase
          .from("patient_emergency_contacts")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
            added_by_user_id: effectiveUserId,
            added_by_role: mapRoleToAuditRole(effectiveRole),
          });
        if (error) throw error;
        // Success! No need to verify with SELECT - RLS may block read-after-write
      }
    },
    {
      queryKey: ["patient-emergency-contacts", patientAccountId],
      updateFn: (oldData: any, variables) => {
        if (mode === "edit") {
          return oldData?.map((item: any) =>
            item.id === contact.id ? { ...item, ...variables } : item
          );
        }
        return [...(oldData || []), { ...variables, id: crypto.randomUUID() }];
      },
      successMessage: mode === "edit" ? "Emergency contact updated successfully" : "Emergency contact added successfully",
      errorMessage: `Failed to ${mode === "edit" ? "update" : "add"} emergency contact`,
      onSuccess: async () => {
        queryClient.invalidateQueries({ queryKey: ["patient-medical-vault-status"] });
        
        // Log audit trail
        const formData = {
          name: watch("name"),
          relationship: watch("relationship"),
          phone: watch("phone"),
          email: watch("email"),
          address: watch("address"),
          preferred_contact_method: watch("preferred_contact_method")
        };
        
        await logMedicalVaultChange({
          patientAccountId,
          actionType: mode === "edit" ? "updated" : "created",
          entityType: "emergency_contact",
          entityId: contact?.id,
          entityName: `${formData.name} (${formData.relationship})`,
          changedByUserId: effectiveUserId || undefined,
          changedByRole: mapRoleToAuditRole(effectiveRole),
          oldData: mode === "edit" ? contact : undefined,
          newData: formData,
          changeSummary: mode === "edit" 
            ? `Updated emergency contact: ${formData.name}` 
            : `Added new emergency contact: ${formData.name}`
        });
        
        onOpenChange(false);
        if (mode === "add") {
          reset();
        }
      },
    }
  );

  const onSubmit = (data: EmergencyContactFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card dark:bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
            {mode === "add" ? "Add Emergency Contact" : mode === "edit" ? "Edit Emergency Contact" : "View Emergency Contact"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Full name"
                disabled={isReadOnly}
                className={errors.name ? "border-red-500" : ""}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship *</Label>
              <Input
                id="relationship"
                {...register("relationship")}
                placeholder="e.g., Spouse, Parent, Sibling"
                disabled={isReadOnly}
                className={errors.relationship ? "border-red-500" : ""}
              />
              {errors.relationship && (
                <p className="text-sm text-red-500">{errors.relationship.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    id="phone"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isReadOnly}
                    required
                  />
                )}
              />
              {errors.phone && (
                <p className="text-sm text-red-500">{errors.phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="email@example.com"
                disabled={isReadOnly}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 Main St, City, State ZIP"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferred_contact_method">Preferred Contact Method</Label>
            <Controller
              name="preferred_contact_method"
              control={control}
              render={({ field }) => (
                <Select
                  disabled={isReadOnly}
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select preferred contact method" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="any">Any Method</SelectItem>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="sms">Text Message (SMS)</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
                className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "edit" ? "Update" : "Add"} Contact
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
