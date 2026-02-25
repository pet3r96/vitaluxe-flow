import { logger } from "@/lib/logger";
import { useState } from "react";
import { EdgeFunctionResponse, getEdgeFunctionErrorAsync } from "@/types/edgeFunction";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PhoneInput } from "@/components/ui/phone-input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { validatePhone } from "@/lib/validators";
import { getCurrentCSRFToken } from "@/lib/csrf";
import { PHARMACY_STAFF_ROLE_TYPES } from "@/types/pharmacyStaff";

interface AddPharmacyStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  pharmacyId: string;
}

export const AddPharmacyStaffDialog = ({ 
  open, 
  onOpenChange, 
  onSuccess, 
  pharmacyId 
}: AddPharmacyStaffDialogProps) => {
  const { effectiveUserId } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
  });
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    roleType: "",
    canManageOrders: true,
    canManageShipping: true,
    canViewApiConfig: false,
  });

  const resetForm = () => {
    setFormData({
      fullName: "",
      email: "",
      phone: "",
      roleType: "",
      canManageOrders: true,
      canManageShipping: true,
      canViewApiConfig: false,
    });
    setValidationErrors({ phone: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone if provided
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.valid) {
        setValidationErrors({ phone: phoneResult.error || "" });
        toast.error("Please fix validation errors before submitting");
        return;
      }
    }

    if (!formData.roleType) {
      toast.error("Please select a role type");
      return;
    }

    setLoading(true);

    try {
      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        toast.error("Session expired. Please refresh the page and try again.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email: formData.email,
          name: formData.fullName,
          role: 'pharmacy_staff',
          csrfToken,
          roleData: {
            pharmacyId: pharmacyId,
            roleType: formData.roleType,
            phone: formData.phone,
            canManageOrders: formData.canManageOrders,
            canManageShipping: formData.canManageShipping,
            canViewApiConfig: formData.canViewApiConfig,
          }
        },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) {
        const errorMsg = await getEdgeFunctionErrorAsync(data, error);
        throw new Error(errorMsg);
      }

      // Send welcome email with activation link
      if (data?.userId) {
        try {
          const { error: emailError } = await supabase.functions.invoke('send-welcome-email', {
            body: {
              userId: data.userId,
              email: formData.email,
              name: formData.fullName,
              role: 'pharmacy_staff',
              pharmacyId: pharmacyId
            }
          });

          if (emailError) {
            logger.error('Failed to send welcome email', emailError);
            toast.warning(`Staff member added but welcome email failed to send.`);
          } else {
            toast.success(`Staff member added! Welcome email with activation link sent to ${formData.email}`);
          }
        } catch (emailErr) {
          logger.error('Error sending welcome email', emailErr);
          toast.warning(`Staff member added but welcome email failed to send.`);
        }
      } else {
        toast.success(`Staff member added successfully`);
      }

      resetForm();
      
      // Invalidate pharmacy staff queries
      queryClient.invalidateQueries({ queryKey: ['pharmacy-staff', pharmacyId] });
      queryClient.invalidateQueries({ queryKey: ['pharmacy-team'] });
      
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add staff member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Pharmacy Staff Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name *</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              placeholder="John Doe"
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
              placeholder="staff@pharmacy.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <PhoneInput
              id="phone"
              value={formData.phone}
              onChange={(value) => {
                setFormData({ ...formData, phone: value });
                setValidationErrors({ phone: "" });
              }}
              placeholder="(555) 123-4567"
            />
            {validationErrors.phone && (
              <p className="text-sm text-destructive">{validationErrors.phone}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleType">Role Type *</Label>
            <Select 
              value={formData.roleType} 
              onValueChange={(value) => setFormData({ ...formData, roleType: value })} 
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role type" />
              </SelectTrigger>
              <SelectContent>
                {PHARMACY_STAFF_ROLE_TYPES.map((roleType) => (
                  <SelectItem key={roleType} value={roleType}>
                    {roleType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <h4 className="font-medium text-sm">Permissions</h4>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="canManageOrders" className="font-medium">
                  Manage Orders
                </Label>
                <p className="text-sm text-muted-foreground">
                  View and update order statuses
                </p>
              </div>
              <Switch
                id="canManageOrders"
                checked={formData.canManageOrders}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, canManageOrders: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="canManageShipping" className="font-medium">
                  Manage Shipping
                </Label>
                <p className="text-sm text-muted-foreground">
                  Update tracking and shipping information
                </p>
              </div>
              <Switch
                id="canManageShipping"
                checked={formData.canManageShipping}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, canManageShipping: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="canViewApiConfig" className="font-medium">
                  View API Configuration
                </Label>
                <p className="text-sm text-muted-foreground">
                  Access API settings and credentials
                </p>
              </div>
              <Switch
                id="canViewApiConfig"
                checked={formData.canViewApiConfig}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, canViewApiConfig: checked })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
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
              {loading ? "Adding..." : "Add Staff Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
