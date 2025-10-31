import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useOptimisticMutation } from "@/hooks/useOptimisticMutation";
import { Loader2 } from "lucide-react";

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  phone: z.string().min(10, "Phone number is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().optional(),
  contact_order: z.number().optional(),
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
  
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmergencyContactFormData>({
    resolver: zodResolver(emergencyContactSchema),
    defaultValues: contact || {
      name: "",
      relationship: "",
      phone: "",
      email: "",
      address: "",
      contact_order: 1,
    },
  });

  const mutation = useOptimisticMutation(
    async (data: EmergencyContactFormData) => {
      const formattedData = {
        name: data.name,
        relationship: data.relationship,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        contact_order: data.contact_order || 1,
      };

      if (mode === "edit" && contact) {
        const { error } = await supabase
          .from("patient_emergency_contacts")
          .update({ ...formattedData, updated_at: new Date().toISOString() })
          .eq("id", contact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patient_emergency_contacts")
          .insert({
            ...formattedData,
            patient_account_id: patientAccountId,
          });
        if (error) throw error;
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
      onSuccess: () => onOpenChange(false),
    }
  );

  const onSubmit = (data: EmergencyContactFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-950 dark:bg-gray-950 border-gray-800">
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
              <Label htmlFor="contact_order">Contact Order</Label>
              <Input
                id="contact_order"
                type="number"
                {...register("contact_order", { valueAsNumber: true })}
                placeholder="1"
                disabled={isReadOnly}
                min="1"
              />
              <p className="text-xs text-muted-foreground">Priority order (1 = first contact)</p>
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
