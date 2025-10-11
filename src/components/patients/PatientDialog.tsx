import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressInput } from "@/components/ui/address-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validatePhone } from "@/lib/validators";

interface PatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: any | null;
  onSuccess: () => void;
}

export const PatientDialog = ({
  open,
  onOpenChange,
  patient,
  onSuccess,
}: PatientDialogProps) => {
  const { user, effectivePracticeId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    birth_date: "",
    allergies: "",
    notes: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    address_formatted: "",
    address_verification_status: "unverified",
    address_verification_source: "",
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        name: patient.name || "",
        email: patient.email || "",
        phone: patient.phone || "",
        birth_date: patient.birth_date || "",
        allergies: patient.allergies || "",
        notes: patient.notes || "",
        address_street: patient.address_street || "",
        address_city: patient.address_city || "",
        address_state: patient.address_state || "",
        address_zip: patient.address_zip || "",
        address_formatted: patient.address_formatted || "",
        address_verification_status: patient.address_verification_status || "unverified",
        address_verification_source: patient.address_verification_source || "",
      });
    } else {
      resetForm();
    }
  }, [patient, open]);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      birth_date: "",
      allergies: "",
      notes: "",
      address_street: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      address_formatted: "",
      address_verification_status: "unverified",
      address_verification_source: "",
    });
    setValidationErrors({ phone: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Patient name is required");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to manage patients");
      return;
    }

    // Validate phone number
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.valid) {
        setValidationErrors({ phone: phoneResult.error || "" });
        toast.error("Please fix validation errors before submitting");
        return;
      }
    }

    setLoading(true);

    try {
      const patientData = {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        birth_date: formData.birth_date || null,
        allergies: formData.allergies || null,
        notes: formData.notes || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        address_formatted: formData.address_formatted || null,
        address_verification_status: formData.address_verification_status,
        address_verification_source: formData.address_verification_source || null,
        address_verified_at: formData.address_verification_status === 'verified' ? new Date().toISOString() : null,
      };

      if (patient) {
        // Update existing patient
        const { error } = await supabase
          .from("patients")
          .update(patientData)
          .eq("id", patient.id);

        if (error) throw error;
        toast.success("✅ Patient updated successfully");
      } else {
        // Create new patient
        if (!effectivePracticeId) {
          toast.error("Unable to determine practice. Please try again.");
          return;
        }
        
        const { error } = await supabase
          .from("patients")
          .insert({
            ...patientData,
            practice_id: effectivePracticeId,
          });

        if (error) throw error;
        toast.success("✅ Patient added successfully");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving patient:", error);
      toast.error(error.message || "Failed to save patient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {patient ? "Edit Patient" : "Add New Patient"}
            </DialogTitle>
            <DialogDescription>
              {patient 
                ? "Update patient information below" 
                : "Enter patient details to add them to your records"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="patient@email.com"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, phone: value });
                    setValidationErrors({ ...validationErrors, phone: "" });
                  }}
                  onBlur={() => {
                    if (formData.phone) {
                      const result = validatePhone(formData.phone);
                      setValidationErrors({ ...validationErrors, phone: result.error || "" });
                    }
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                  className={validationErrors.phone ? "border-destructive" : ""}
                />
                {validationErrors.phone && (
                  <p className="text-sm text-destructive">{validationErrors.phone}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="birth_date">Date of Birth</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) =>
                  setFormData({ ...formData, birth_date: e.target.value })
                }
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <AddressInput
              label="Patient Address"
              value={{
                street: formData.address_street,
                city: formData.address_city,
                state: formData.address_state,
                zip: formData.address_zip,
              }}
              onChange={(addressData) => {
                setFormData({
                  ...formData,
                  address_street: addressData.street || "",
                  address_city: addressData.city || "",
                  address_state: addressData.state || "",
                  address_zip: addressData.zip || "",
                  address_formatted: addressData.formatted || "",
                  address_verification_status: addressData.status || "unverified",
                  address_verification_source: addressData.source || "",
                });
              }}
            />

            <div className="grid gap-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Input
                id="allergies"
                value={formData.allergies}
                onChange={(e) =>
                  setFormData({ ...formData, allergies: e.target.value })
                }
                placeholder="Penicillin, Latex, etc."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional patient information"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : patient ? "Update Patient" : "Add Patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
