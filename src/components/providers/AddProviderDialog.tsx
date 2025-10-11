import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { validatePhone, validateNPI, validateDEA } from "@/lib/validators";

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  practiceId?: string;
}

export const AddProviderDialog = ({ open, onOpenChange, onSuccess, practiceId }: AddProviderDialogProps) => {
  const { effectiveUserId, effectiveRole } = useAuth();
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
    password: "",
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
      password: "",
      npi: "",
      dea: "",
      licenseNumber: "",
      phone: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate fields
    const phoneResult = validatePhone(formData.phone);
    const npiResult = validateNPI(formData.npi);
    const deaResult = validateDEA(formData.dea);
    
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
      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email: formData.email,
          password: formData.password,
          name: formData.email,
          fullName: formData.fullName,
          prescriberName: formData.prescriberName,
          role: 'provider',
          roleData: {
            practiceId: targetPracticeId,
            npi: formData.npi,
            dea: formData.dea,
            licenseNumber: formData.licenseNumber,
            phone: formData.phone,
          }
        }
      });

      if (error || data?.error) {
        throw new Error(data?.error || error.message);
      }

      toast.success("Provider added successfully");
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

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Secure password"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="npi">Provider NPI # *</Label>
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
            <Label htmlFor="dea">Provider DEA #</Label>
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
          <Input
            id="phone"
            type="tel"
            value={formData.phone || ""}
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
            className={validationErrors.phone ? "border-destructive" : ""}
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
