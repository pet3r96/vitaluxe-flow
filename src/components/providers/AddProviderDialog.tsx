import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhoneInput } from "@/components/ui/phone-input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { validatePhone, validateNPI, validateDEA } from "@/lib/validators";
import { getCurrentCSRFToken } from "@/lib/csrf";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  practiceId?: string;
}

export const AddProviderDialog = ({ open, onOpenChange, onSuccess, practiceId }: AddProviderDialogProps) => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const { isSubscribed, status, trialEndsAt, currentPeriodEnd } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState(practiceId || "");
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
    npi: "",
    dea: "",
  });
  const [formData, setFormData] = useState({
    fullName: "",
    prescriberName: "",
    email: "",
    npi: "",
    dea: "",
    licenseNumber: "",
    phone: "",
  });

  const { data: practices } = useQuery({
    queryKey: ["practices"],
    queryFn: async () => {
      // First get all doctor user IDs (doctor role = Practice accounts in the database)
      const { data: doctorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "doctor"); // Practice accounts use the doctor role internally
      
      if (rolesError) throw rolesError;
      
      const doctorIds = doctorRoles?.map(r => r.user_id) || [];
      
      if (doctorIds.length === 0) return [];
      
      // Then get their profiles
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, company, email")
        .in("id", doctorIds);
      
      if (error) throw error;
      return data;
    },
    enabled: effectiveRole === "admin" && !practiceId
  });

  const resetForm = () => {
    setFormData({
      fullName: "",
      prescriberName: "",
      email: "",
      npi: "",
      dea: "",
      licenseNumber: "",
      phone: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check Pro subscription requirement
    const hasActivePro = 
      (status === 'trial' && trialEndsAt && new Date(trialEndsAt) > new Date()) ||
      (status === 'active' && currentPeriodEnd && new Date(currentPeriodEnd) > new Date());
    
    if (!hasActivePro) {
      toast.error("VitaLuxePro subscription required to add providers. Please upgrade your practice subscription.");
      return;
    }
    
    // Validate required NPI field first
    if (!formData.npi || !formData.npi.trim()) {
      setValidationErrors({ ...validationErrors, npi: "NPI is required" });
      toast.error("Provider NPI is required");
      return;
    }
    
    // Validate fields
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
    
    const targetPracticeId = practiceId || selectedPractice || effectiveUserId;
    if (!targetPracticeId) {
      toast.error("Please select a practice");
      return;
    }

    setLoading(true);

    try {
      // Fetch CSRF token
      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        toast.error("Session expired. Please refresh the page and try again.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email: formData.email,
          name: formData.email,
          fullName: formData.fullName,
          prescriberName: formData.prescriberName,
          role: 'provider',
          csrfToken, // Include in body as fallback
          roleData: {
            practiceId: targetPracticeId,
            npi: formData.npi,
            dea: formData.dea,
            licenseNumber: formData.licenseNumber,
            phone: formData.phone,
          }
        },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) {
        throw new Error((data as any)?.error || error.message);
      }

      toast.success(`Provider added! Welcome email with login credentials sent to ${formData.email}`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add provider");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Provider</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {effectiveRole === "admin" && !practiceId && (
            <div className="space-y-2">
              <Label htmlFor="practice">Practice *</Label>
              <Select value={selectedPractice} onValueChange={setSelectedPractice} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select a practice" />
                </SelectTrigger>
                <SelectContent>
                  {practices?.map((practice) => (
                    <SelectItem key={practice.id} value={practice.id}>
                      {practice.name || practice.company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Dr. John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prescriberName">Prescriber Name *</Label>
              <Input
                id="prescriberName"
                value={formData.prescriberName}
                onChange={(e) => setFormData({ ...formData, prescriberName: e.target.value })}
                placeholder="Name on prescriptions"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="provider@example.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="npi">Provider NPI # *</Label>
            <Input
              id="npi"
              type="tel"
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
            <Label htmlFor="dea">Provider DEA #</Label>
            <Input
              id="dea"
              type="text"
              value={formData.dea}
              onChange={(e) => {
                let value = e.target.value.toUpperCase();
                value = value.replace(/[^A-Z0-9]/g, '');
                if (value.length <= 2) {
                  value = value.replace(/[^A-Z]/g, '');
                } else {
                  const letters = value.slice(0, 2).replace(/[^A-Z]/g, '');
                  const digits = value.slice(2).replace(/\D/g, '');
                  value = letters + digits;
                }
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

        <div className="space-y-2">
          <Label htmlFor="licenseNumber">License Number *</Label>
          <Input
            id="licenseNumber"
            value={formData.licenseNumber}
            onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
            placeholder="Medical license number"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <PhoneInput
            id="phone"
            value={formData.phone || ""}
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

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Provider"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
