import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validatePhone, validateNPI, validateDEA } from "@/lib/validators";
import { verifyNPIDebounced } from "@/lib/npiVerification";
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import { useQueryClient } from "@tanstack/react-query";

interface AddPracticeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const AddPracticeRequestDialog = ({ open, onOpenChange, onSuccess }: AddPracticeRequestDialogProps) => {
  const { user, effectiveRole, effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<
    null | "verifying" | "verified" | "failed"
  >(null);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
    npi: "",
    dea: "",
  });
  const [formData, setFormData] = useState({
    practice_name: "",
    email: "",
    npi: "",
    license_number: "",
    dea: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    address_formatted: "",
    address_verification_status: "unverified",
    address_verified_at: undefined as Date | undefined,
    address_verification_source: "",
  });

  // Track latest NPI value to guard against stale callback updates
  const currentNpiRef = useRef(formData.npi);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields - NPI is now always required
    if (!formData.practice_name || !formData.email || !formData.phone || !formData.npi || !formData.license_number) {
      toast.error("Please fill in all required fields (Practice Name, Email, Phone, NPI, License Number)");
      return;
    }

    // NPI must always be verified
    if (npiVerificationStatus !== "verified") {
      if (npiVerificationStatus === "verifying") {
        toast.error("Please wait for NPI verification to complete");
      } else {
        toast.error("NPI must be verified before submitting");
      }
      return;
    }

    // Validate all fields
    const phoneResult = validatePhone(formData.phone);
    const npiResult = validateNPI(formData.npi);
    const deaResult = formData.dea ? validateDEA(formData.dea) : { valid: true };
    
    if (!phoneResult.valid || !npiResult.valid || !deaResult.valid) {
      setValidationErrors({
        phone: phoneResult.error || "",
        npi: npiResult.error || "",
        dea: deaResult.error || "",
      });
      toast.error("Please fix validation errors before submitting");
      return;
    }
    
    setLoading(true);

    try {
      if (!effectiveUserId) {
        throw new Error("User not authenticated");
      }

      const { error } = await supabase
        .from("pending_practices")
        .insert([{
          created_by_user_id: effectiveUserId,
          has_prescriber: true, // Always true now
          practice_name: formData.practice_name,
          email: formData.email,
          phone: formData.phone || null,
          npi: formData.npi,
          license_number: formData.license_number,
          dea: formData.dea || null,
          address_street: formData.address_street || null,
          address_city: formData.address_city || null,
          address_state: formData.address_state || null,
          address_zip: formData.address_zip || null,
          address_formatted: formData.address_formatted || null,
          assigned_rep_user_id: (effectiveRole === 'topline' || effectiveRole === 'downline') ? effectiveUserId : null,
          company: formData.practice_name,
          created_by_role: (effectiveRole === 'admin' || effectiveRole === 'doctor' || effectiveRole === 'topline' || effectiveRole === 'downline') ? effectiveRole : 'admin',
          prescriber_full_name: "",
          prescriber_name: "",
          prescriber_npi: "",
          prescriber_dea: null,
          prescriber_license: "",
          prescriber_phone: null
        }]);

      if (error) throw error;

      // Invalidate queries for immediate UI update
      queryClient.invalidateQueries({ 
        queryKey: ['rep-pending-practices', effectiveUserId] 
      });

      toast.success("Practice request submitted for admin approval");
      onSuccess?.();
      onOpenChange(false);
      setNpiVerificationStatus(null);
      setFormData({
        practice_name: "",
        email: "",
        npi: "",
        license_number: "",
        dea: "",
        phone: "",
        address_street: "",
        address_city: "",
        address_state: "",
        address_zip: "",
        address_formatted: "",
        address_verification_status: "unverified",
        address_verified_at: undefined,
        address_verification_source: "",
      });
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error submitting practice request", error);
      });
      toast.error(error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
      >
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
              
              <div className="space-y-2 col-span-2">
                <Label htmlFor="phone">Phone *</Label>
                <PhoneInput
                  id="phone"
                  value={formData.phone}
                  onChange={(value) => {
                    setFormData({ ...formData, phone: value });
                    setValidationErrors({ ...validationErrors, phone: "" });
                  }}
                  placeholder="(555) 123-4567"
                  required
                />
                {validationErrors.phone && (
                  <p className="text-sm text-destructive">{validationErrors.phone}</p>
                )}
              </div>

            </div>

            {/* NPI - Now always required */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="npi">NPI *</Label>
                <Input
                  id="npi"
                  value={formData.npi}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, npi: value });
                    currentNpiRef.current = value;
                    setValidationErrors(prev => ({ ...prev, npi: "" }));
                    
                    // Reset verification status when NPI changes
                    if (value.length !== 10) {
                      setNpiVerificationStatus(null);
                    } else {
                      setNpiVerificationStatus("verifying");
                    }
                    
                    // Real-time NPI verification
                    if (value && value.length === 10) {
                      const expectedNpi = value; // Capture current value
                      verifyNPIDebounced(value, (result) => {
                        // Only apply if this result matches the latest input value
                        if (currentNpiRef.current === expectedNpi) {
                          if (result.valid && !result.error) {
                            setNpiVerificationStatus("verified");
                            setValidationErrors(prev => ({ ...prev, npi: "" }));
                            if (result.providerName) {
                              toast.success(`NPI Verified: ${result.providerName}${result.specialty ? ` - ${result.specialty}` : ''}`);
                            } else {
                              toast.success(`NPI ${result.npi} verified successfully${result.type ? ` (${result.type})` : ''}`);
                            }
                          } else {
                            // Failed or has error
                            setNpiVerificationStatus("failed");
                            setValidationErrors(prev => ({ 
                              ...prev, 
                              npi: result.error || "NPI verification failed" 
                            }));
                          }
                        }
                      });
                    }
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
                {npiVerificationStatus === "verifying" && (
                  <p className="text-sm text-muted-foreground">🔄 Verifying NPI...</p>
                )}
                {npiVerificationStatus === "verified" && (
                  <p className="text-sm text-green-600">✓ NPI Verified</p>
                )}
                {npiVerificationStatus === "verified" && (
                  <p className="text-xs text-muted-foreground">Verified against NPPES registry</p>
                )}
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
                <Label htmlFor="dea">DEA # (Optional)</Label>
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
            <GoogleAddressAutocomplete
              value={{
                street: formData.address_street,
                city: formData.address_city,
                state: formData.address_state,
                zip: formData.address_zip,
              }}
              onChange={(addr) => setFormData({
                ...formData,
                address_street: addr.street || "",
                address_city: addr.city || "",
                address_state: addr.state || "",
                address_zip: addr.zip || "",
                address_formatted: addr.formatted || "",
                address_verification_status: addr.status === 'verified' || addr.status === 'manual' || addr.status === 'unverified' ? addr.status : 'unverified',
                address_verified_at: addr.verified_at ? new Date(addr.verified_at) : undefined,
                address_verification_source: addr.source || "",
              })}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || npiVerificationStatus !== "verified"}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
