import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
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
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import { PhoneInput } from "@/components/ui/phone-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { validatePhone, validateEmail } from "@/lib/validators";
import { logPatientPHIAccess } from "@/lib/auditLogger";

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
  const { user, effectivePracticeId, effectiveRole } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
    email: "",
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

  const [decryptedPHI, setDecryptedPHI] = useState<{
    allergies: string | null;
    notes: string | null;
  }>({ allergies: null, notes: null });

  useEffect(() => {
    const loadPatientData = async () => {
      if (!patient) {
        resetForm();
        setDecryptedPHI({ allergies: null, notes: null });
        return;
      }

      // Fetch full patient data if any required fields are missing
      let fullPatient = patient;
      if (!patient.birth_date || patient.allergies === undefined || patient.notes === undefined) {
        try {
          const { data: fetchedPatient, error } = await supabase
            .from("patient_accounts")
            .select("id, name, first_name, last_name, email, phone, birth_date, date_of_birth, allergies, notes, address_street, address_city, address_state, address_zip, address_formatted, address_verification_status, address_verification_source")
            .eq("id", patient.id)
            .single();

          if (error) throw error;
          if (fetchedPatient) {
            fullPatient = fetchedPatient;
          }
        } catch (error) {
          console.error('[PatientDialog] Failed to fetch full patient data:', error);
          toast.error('Failed to load complete patient information');
        }
      }

      // Set base fields immediately
      const birthRaw = fullPatient.birth_date as string | null;
      let birthFormatted = "";
      if (birthRaw) {
        if (typeof birthRaw === "string") {
          birthFormatted = birthRaw.includes("T")
            ? birthRaw.split("T")[0]
            : birthRaw.slice(0, 10);
        } else {
          try {
            birthFormatted = new Date(birthRaw as any).toISOString().split("T")[0];
          } catch {}
        }
      }
      const baseData = {
        name: fullPatient.name || "",
        email: fullPatient.email || "",
        phone: fullPatient.phone || "",
        birth_date: birthFormatted,
        address_street: fullPatient.address_street || "",
        address_city: fullPatient.address_city || "",
        address_state: fullPatient.address_state || "",
        address_zip: fullPatient.address_zip || "",
        address_formatted: fullPatient.address_formatted || "",
        address_verification_status: fullPatient.address_verification_status || "unverified",
        address_verification_source: fullPatient.address_verification_source || "",
      };

      // Check if allergies or notes are encrypted
      const hasEncryptedData = fullPatient.allergies === '[ENCRYPTED]' || fullPatient.notes === '[ENCRYPTED]';
      
      if (!hasEncryptedData) {
        // No encryption, use plain text values directly
        setDecryptedPHI({
          allergies: fullPatient.allergies,
          notes: fullPatient.notes
        });
        setFormData({
          ...baseData,
          allergies: fullPatient.allergies || "",
          notes: fullPatient.notes || ""
        });
        return;
      }

      // Encrypted - decrypt first
      try {
        const { data, error } = await supabase.rpc('get_decrypted_patient_phi', {
          p_patient_id: fullPatient.id
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setDecryptedPHI({
            allergies: data[0].allergies,
            notes: data[0].notes
          });
          setFormData({
            ...baseData,
            allergies: data[0].allergies || "",
            notes: data[0].notes || ""
          });
        } else {
          // Fallback to empty if no data
          setFormData({
            ...baseData,
            allergies: "",
            notes: ""
          });
        }
      } catch (error) {
        console.error('[PatientDialog] Failed to decrypt patient PHI:', error);
        toast.error('Failed to load patient information');
        // Fallback to empty on error
        setFormData({
          ...baseData,
          allergies: "",
          notes: ""
        });
      }
    };

    loadPatientData();
  }, [patient, open]);

  // HIPAA Compliance: Log PHI access when viewing patient with sensitive data
  useEffect(() => {
    if (patient && open && user) {
      const hasPHI = patient.allergies || patient.notes || patient.address_formatted;
      
      if (hasPHI) {
        // Determine relationship based on role
        let relationship: 'practice_admin' | 'provider' | 'admin' = 'practice_admin';
        if (effectiveRole === 'admin') {
          relationship = 'admin';
        } else if (effectiveRole === 'provider') {
          relationship = 'provider';
        }

        logPatientPHIAccess({
          patientId: patient.id,
          patientName: patient.name,
          accessedFields: {
            allergies: !!patient.allergies,
            notes: !!patient.notes,
            address: !!patient.address_formatted,
          },
          viewerRole: effectiveRole || 'doctor',
          relationship,
          componentContext: 'PatientDialog',
        });
      }
    }
  }, [patient, open, user, effectiveRole]);

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
    setValidationErrors({ phone: "", email: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Patient name is required");
      return;
    }

    if (!formData.birth_date) {
      toast.error("Date of birth is required");
      return;
    }

    if (!formData.address_street || !formData.address_city || !formData.address_state || !formData.address_zip) {
      toast.error("Complete address is required (street, city, state, zip)");
      return;
    }

    if (!formData.allergies.trim()) {
      toast.error("Allergies field is required (enter 'None' if no known allergies)");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to manage patients");
      return;
    }

    // Validate phone if provided
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.valid) {
        setValidationErrors({ ...validationErrors, phone: phoneResult.error || "", email: validationErrors.email });
        toast.error("Please fix validation errors before submitting");
        return;
      }
    }

    // Validate email if provided
    if (formData.email) {
      const emailResult = validateEmail(formData.email);
      if (!emailResult.valid) {
        setValidationErrors({ ...validationErrors, email: emailResult.error || "", phone: validationErrors.phone });
        toast.error("Please fix validation errors before submitting");
        return;
      }
    }

    setLoading(true);

    try {
      // Parse name into first and last name
      const nameParts = formData.name.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      const patientData = {
        name: formData.name,
        first_name: firstName,
        last_name: lastName,
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
        // Update existing patient - CRITICAL: Verify patient.id to prevent cross-patient updates
        if (!patient.id) {
          throw new Error("Patient ID is required for updates");
        }

        console.log('[PatientDialog] Updating patient:', { 
          patientId: patient.id, 
          email: patientData.email 
        });

        const { data: updated, error } = await supabase
          .from("patient_accounts")
          .update(patientData)
          .eq("id", patient.id)
          .select("*")
          .single();

        if (error) throw error;
        if (!updated) {
          throw new Error("Update failed (no row returned)");
        }
        
        console.log('[PatientDialog] Update success:', { id: updated.id });
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        queryClient.invalidateQueries({ queryKey: ["patient", patient.id] });
        queryClient.invalidateQueries({ queryKey: ["patient-portal-status", patient.id] });
        toast.success("✅ Patient updated successfully");
      } else {
        // Create new patient
        if (!effectivePracticeId) {
          toast.error("Unable to determine practice. Please try again.");
          return;
        }
        
        const { error } = await supabase
          .from("patient_accounts")
          .insert([{
            ...patientData,
            practice_id: effectivePracticeId,
          }]);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["patients"] });
        queryClient.invalidateQueries({ queryKey: ["patient-portal-status"] });
        toast.success("✅ Patient added successfully");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error saving patient", error);
      });
      toast.error(error.message || "Failed to save patient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px]"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
      >
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
                <Label htmlFor="email">Email (Optional)</Label>
                <Input
                  id="email"
                  type="text"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setValidationErrors({ ...validationErrors, email: "" });
                  }}
                  onBlur={() => {
                    if (formData.email) {
                      const result = validateEmail(formData.email);
                      setValidationErrors({ ...validationErrors, email: result.error || "" });
                    }
                  }}
                  placeholder="patient@email.com (optional)"
                  className={validationErrors.email ? "border-destructive" : ""}
                />
                {validationErrors.email && (
                  <p className="text-sm text-destructive">{validationErrors.email}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="phone">Phone (Optional)</Label>
                <PhoneInput
                  id="phone"
                  value={formData.phone}
                  onChange={(value) => {
                    setFormData({ ...formData, phone: value });
                    setValidationErrors({ ...validationErrors, phone: "" });
                  }}
                  placeholder="(555) 123-4567"
                />
                {validationErrors.phone && (
                  <p className="text-sm text-destructive">{validationErrors.phone}</p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="birth_date">Date of Birth *</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) =>
                  setFormData({ ...formData, birth_date: e.target.value })
                }
                max={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <GoogleAddressAutocomplete
              label="Patient Address *"
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
              <Label htmlFor="allergies">Allergies *</Label>
              <Textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) =>
                  setFormData({ ...formData, allergies: e.target.value })
                }
                placeholder="Enter allergies or 'None' if no known allergies"
                rows={3}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional patient information"
                rows={3}
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
