import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Edit2, Save, X } from "lucide-react";

interface ProviderDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: any;
  onSuccess: () => void;
}

export const ProviderDetailsDialog = ({ 
  open, 
  onOpenChange, 
  provider, 
  onSuccess 
}: ProviderDetailsDialogProps) => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: provider.full_name || "",
    prescriberName: provider.prescriber_name || "",
    npi: provider.npi || "",
    dea: provider.dea || "",
    licenseNumber: provider.license_number || "",
    phone: provider.phone || "",
  });

  const isPractice = effectiveRole === "doctor" && effectiveUserId === provider.practice_id;
  const isOwnProvider = effectiveRole === "provider" && effectiveUserId === provider.id;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      // Providers can only update their phone
      if (isOwnProvider) {
        updateData.phone = formData.phone;
      } else if (isPractice) {
        // Practices can update everything except active status
        updateData.full_name = formData.fullName;
        updateData.prescriber_name = formData.prescriberName;
        updateData.npi = formData.npi;
        updateData.dea = formData.dea;
        updateData.license_number = formData.licenseNumber;
        updateData.phone = formData.phone;
      }

      const { error } = await supabase
        .from("providers" as any)
        .update(updateData)
        .eq("id", provider.id);

      if (error) throw error;

      toast.success("Provider updated successfully");
      setIsEditing(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to update provider");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Provider Details</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={provider.active ? "default" : "secondary"}>
                {provider.active ? "Active" : "Inactive"}
              </Badge>
              {!isEditing && (isPractice || isOwnProvider) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              {isEditing && isPractice ? (
                <Input
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{provider.full_name}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Prescriber Name</Label>
              {isEditing && isPractice ? (
                <Input
                  value={formData.prescriberName}
                  onChange={(e) => setFormData({ ...formData, prescriberName: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{provider.prescriber_name}</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="p-2 bg-muted rounded-md">{provider.email}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider NPI #</Label>
              {isEditing && isPractice ? (
                <Input
                  value={formData.npi}
                  onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{provider.npi}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Provider DEA #</Label>
              {isEditing && isPractice ? (
                <Input
                  value={formData.dea}
                  onChange={(e) => setFormData({ ...formData, dea: e.target.value })}
                />
              ) : (
                <div className="p-2 bg-muted rounded-md">{provider.dea || "N/A"}</div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>License Number</Label>
            {isEditing && isPractice ? (
              <Input
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{provider.license_number}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            {isEditing ? (
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{provider.phone || "N/A"}</div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    fullName: provider.full_name || "",
                    prescriberName: provider.prescriber_name || "",
                    npi: provider.npi || "",
                    dea: provider.dea || "",
                    licenseNumber: provider.license_number || "",
                    phone: provider.phone || "",
                  });
                }}
                disabled={loading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
