import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validatePhone, validateNPI, validateDEA } from "@/lib/validators";

interface AddPracticeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddPracticeRequestDialog = ({ open, onOpenChange, onSuccess }: AddPracticeRequestDialogProps) => {
  const { user, effectiveRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
    npi: "",
    dea: "",
    prescriberPhone: "",
    prescriberNpi: "",
    prescriberDea: "",
  });
  const [formData, setFormData] = useState({
    practice_name: "",
    email: "",
    npi: "",
    license_number: "",
    dea: "",
    company: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    prescriber_full_name: "",
    prescriber_name: "",
    prescriber_npi: "",
    prescriber_dea: "",
    prescriber_license: "",
    prescriber_phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const phoneResult = validatePhone(formData.phone);
    const npiResult = validateNPI(formData.npi);
    const deaResult = validateDEA(formData.dea);
    const prescriberPhoneResult = validatePhone(formData.prescriber_phone);
    const prescriberNpiResult = validateNPI(formData.prescriber_npi);
    const prescriberDeaResult = validateDEA(formData.prescriber_dea);
    
    if (!phoneResult.valid || !npiResult.valid || !deaResult.valid ||
        !prescriberPhoneResult.valid || !prescriberNpiResult.valid || !prescriberDeaResult.valid) {
      setValidationErrors({
        phone: phoneResult.error || "",
        npi: npiResult.error || "",
        dea: deaResult.error || "",
        prescriberPhone: prescriberPhoneResult.error || "",
        prescriberNpi: prescriberNpiResult.error || "",
        prescriberDea: prescriberDeaResult.error || "",
      });
      toast.error("Please fix validation errors before submitting");
      return;
    }
    
    setLoading(true);

    try {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase
        .from("pending_practices")
        .insert([{
          created_by_user_id: user.id,
          created_by_role: effectiveRole as any,
          assigned_rep_user_id: user.id,
          practice_name: formData.practice_name,
          email: formData.email,
          npi: formData.npi,
          license_number: formData.license_number,
          dea: formData.dea || null,
          company: formData.company,
          phone: formData.phone,
          address_street: formData.address_street,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip,
          prescriber_full_name: formData.prescriber_full_name,
          prescriber_name: formData.prescriber_name,
          prescriber_npi: formData.prescriber_npi,
          prescriber_dea: formData.prescriber_dea || null,
          prescriber_license: formData.prescriber_license,
          prescriber_phone: formData.prescriber_phone || null,
        }]);

      if (error) throw error;

      toast.success("Practice request submitted for admin approval");
      onSuccess?.();
      onOpenChange(false);
      setFormData({
        practice_name: "",
        email: "",
        npi: "",
        license_number: "",
        dea: "",
        company: "",
        phone: "",
        address_street: "",
        address_city: "",
        address_state: "",
        address_zip: "",
        prescriber_full_name: "",
        prescriber_name: "",
        prescriber_npi: "",
        prescriber_dea: "",
        prescriber_license: "",
        prescriber_phone: "",
      });
    } catch (error: any) {
      console.error("Error submitting practice request:", error);
      toast.error(error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Request New Practice</DialogTitle>
          <DialogDescription>
            Submit a request to add a new practice. An admin will review and approve it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-semibold">Practice Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="practice_name">Practice Name *</Label>
                <Input
                  id="practice_name"
                  value={formData.practice_name}
                  onChange={(e) => setFormData({ ...formData, practice_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
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
                    const result = validatePhone(formData.phone);
                    setValidationErrors({ ...validationErrors, phone: result.error || "" });
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                  required
                  className={validationErrors.phone ? "border-destructive" : ""}
                />
                {validationErrors.phone && (
                  <p className="text-sm text-destructive">{validationErrors.phone}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company *</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="npi">NPI *</Label>
                <Input
                  id="npi"
                  value={formData.npi}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, npi: value });
                    setValidationErrors({ ...validationErrors, npi: "" });
                  }}
                  onBlur={() => {
                    const result = validateNPI(formData.npi);
                    setValidationErrors({ ...validationErrors, npi: result.error || "" });
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                  required
                  className={validationErrors.npi ? "border-destructive" : ""}
                />
                {validationErrors.npi && (
                  <p className="text-sm text-destructive">{validationErrors.npi}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="license_number">License Number *</Label>
                <Input
                  id="license_number"
                  value={formData.license_number}
                  onChange={(e) => setFormData({ ...formData, license_number: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dea">DEA</Label>
                <Input
                  id="dea"
                  value={formData.dea}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setFormData({ ...formData, dea: value });
                    setValidationErrors({ ...validationErrors, dea: "" });
                  }}
                  onBlur={() => {
                    const result = validateDEA(formData.dea);
                    setValidationErrors({ ...validationErrors, dea: result.error || "" });
                  }}
                  placeholder="AB1234567"
                  maxLength={9}
                  className={validationErrors.dea ? "border-destructive" : ""}
                />
                {validationErrors.dea && (
                  <p className="text-sm text-destructive">{validationErrors.dea}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Practice Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address_street">Street Address *</Label>
                <Input
                  id="address_street"
                  value={formData.address_street}
                  onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_city">City *</Label>
                <Input
                  id="address_city"
                  value={formData.address_city}
                  onChange={(e) => setFormData({ ...formData, address_city: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_state">State *</Label>
                <Input
                  id="address_state"
                  value={formData.address_state}
                  onChange={(e) => setFormData({ ...formData, address_state: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address_zip">ZIP Code *</Label>
                <Input
                  id="address_zip"
                  value={formData.address_zip}
                  onChange={(e) => setFormData({ ...formData, address_zip: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Prescriber Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prescriber_full_name">Full Name *</Label>
                <Input
                  id="prescriber_full_name"
                  value={formData.prescriber_full_name}
                  onChange={(e) => setFormData({ ...formData, prescriber_full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriber_name">Display Name *</Label>
                <Input
                  id="prescriber_name"
                  value={formData.prescriber_name}
                  onChange={(e) => setFormData({ ...formData, prescriber_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriber_npi">NPI *</Label>
                <Input
                  id="prescriber_npi"
                  value={formData.prescriber_npi}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, prescriber_npi: value });
                    setValidationErrors({ ...validationErrors, prescriberNpi: "" });
                  }}
                  onBlur={() => {
                    const result = validateNPI(formData.prescriber_npi);
                    setValidationErrors({ ...validationErrors, prescriberNpi: result.error || "" });
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                  required
                  className={validationErrors.prescriberNpi ? "border-destructive" : ""}
                />
                {validationErrors.prescriberNpi && (
                  <p className="text-sm text-destructive">{validationErrors.prescriberNpi}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriber_license">License *</Label>
                <Input
                  id="prescriber_license"
                  value={formData.prescriber_license}
                  onChange={(e) => setFormData({ ...formData, prescriber_license: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriber_dea">DEA</Label>
                <Input
                  id="prescriber_dea"
                  value={formData.prescriber_dea}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase();
                    setFormData({ ...formData, prescriber_dea: value });
                    setValidationErrors({ ...validationErrors, prescriberDea: "" });
                  }}
                  onBlur={() => {
                    const result = validateDEA(formData.prescriber_dea);
                    setValidationErrors({ ...validationErrors, prescriberDea: result.error || "" });
                  }}
                  placeholder="AB1234567"
                  maxLength={9}
                  className={validationErrors.prescriberDea ? "border-destructive" : ""}
                />
                {validationErrors.prescriberDea && (
                  <p className="text-sm text-destructive">{validationErrors.prescriberDea}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="prescriber_phone">Phone</Label>
                <Input
                  id="prescriber_phone"
                  type="tel"
                  value={formData.prescriber_phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, prescriber_phone: value });
                    setValidationErrors({ ...validationErrors, prescriberPhone: "" });
                  }}
                  onBlur={() => {
                    const result = validatePhone(formData.prescriber_phone);
                    setValidationErrors({ ...validationErrors, prescriberPhone: result.error || "" });
                  }}
                  placeholder="1234567890"
                  maxLength={10}
                  className={validationErrors.prescriberPhone ? "border-destructive" : ""}
                />
                {validationErrors.prescriberPhone && (
                  <p className="text-sm text-destructive">{validationErrors.prescriberPhone}</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};