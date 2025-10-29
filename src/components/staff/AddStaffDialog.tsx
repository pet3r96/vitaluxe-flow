import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { validatePhone } from "@/lib/validators";
import { getCurrentCSRFToken } from "@/lib/csrf";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  practiceId?: string;
}

const STAFF_ROLE_TYPES = [
  "Nurse Practitioner (NP)",
  "Physician Assistant (PA)",
  "Registered Nurse (RN)",
  "Medical Assistant (MA)",
  "Receptionist",
  "Manager",
  "Admin",
  "Other"
];

export const AddStaffDialog = ({ open, onOpenChange, onSuccess, practiceId }: AddStaffDialogProps) => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const { isSubscribed, status, trialEndsAt, currentPeriodEnd } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState(practiceId || "");
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
  });
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    roleType: "",
    canOrder: false,
  });

  const { data: practices } = useQuery({
    queryKey: ["practices"],
    queryFn: async () => {
      const { data: doctorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "doctor");
      
      if (rolesError) throw rolesError;
      
      const doctorIds = doctorRoles?.map(r => r.user_id) || [];
      
      if (doctorIds.length === 0) return [];
      
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
      email: "",
      phone: "",
      roleType: "",
      canOrder: false,
    });
    setSelectedPractice(practiceId || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check Pro subscription requirement
    const hasActivePro = 
      (status === 'trial' && trialEndsAt && new Date(trialEndsAt) > new Date()) ||
      (status === 'active' && currentPeriodEnd && new Date(currentPeriodEnd) > new Date());
    
    if (!hasActivePro) {
      toast.error("VitaLuxePro subscription required to add staff members. Please upgrade your practice subscription.");
      return;
    }
    
    // Validate phone if provided
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.valid) {
        setValidationErrors({ phone: phoneResult.error || "" });
        toast.error("Please fix validation errors before submitting");
        return;
      }
    }
    
    const targetPracticeId = practiceId || selectedPractice || effectiveUserId;
    if (!targetPracticeId) {
      toast.error("Please select a practice");
      return;
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
          role: 'staff',
          csrfToken,
          roleData: {
            practiceId: targetPracticeId,
            roleType: formData.roleType,
            phone: formData.phone,
            canOrder: formData.canOrder,
          }
        },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) {
        throw new Error((data as any)?.error || error.message);
      }

      toast.success(`Staff member added! Welcome email with login credentials sent to ${formData.email}`);
      resetForm();
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Staff Member</DialogTitle>
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
              placeholder="staff@example.com"
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
                setValidationErrors({ phone: "" });
              }}
              onBlur={() => {
                if (formData.phone) {
                  const result = validatePhone(formData.phone);
                  setValidationErrors({ phone: result.error || "" });
                }
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
            <Label htmlFor="roleType">Role Type *</Label>
            <Select value={formData.roleType} onValueChange={(value) => setFormData({ ...formData, roleType: value })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select role type" />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLE_TYPES.map((roleType) => (
                  <SelectItem key={roleType} value={roleType}>
                    {roleType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="canOrder" className="font-medium">
                  Ordering Privileges
                </Label>
                <p className="text-sm text-muted-foreground">
                  Allow this staff member to place orders on behalf of the practice
                </p>
              </div>
              <Switch
                id="canOrder"
                checked={formData.canOrder}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, canOrder: checked })
                }
              />
            </div>
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
              {loading ? "Adding..." : "Add Staff Member"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
