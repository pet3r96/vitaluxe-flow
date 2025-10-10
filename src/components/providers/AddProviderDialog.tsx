import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface AddProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddProviderDialog = ({ open, onOpenChange, onSuccess }: AddProviderDialogProps) => {
  const { effectiveUserId } = useAuth();
  const [loading, setLoading] = useState(false);
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
            practiceId: effectiveUserId,
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
                onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                placeholder="10-digit NPI"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dea">Provider DEA #</Label>
              <Input
                id="dea"
                value={formData.dea}
                onChange={(e) => setFormData({ ...formData, dea: e.target.value })}
                placeholder="DEA number (optional)"
              />
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
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="(555) 123-4567"
            />
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
