import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PhoneInput } from "@/components/ui/phone-input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Edit2, Save, X } from "lucide-react";

interface StaffDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: any;
  onSuccess: () => void;
}

export const StaffDetailsDialog = ({ 
  open, 
  onOpenChange, 
  staff, 
  onSuccess 
}: StaffDetailsDialogProps) => {
  const { effectiveRole, effectiveUserId } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: staff.profiles?.full_name || staff.profiles?.name || "",
    phone: staff.profiles?.phone ? staff.profiles.phone.replace(/\D/g, "") : "",
  });

  const isPractice = effectiveRole === "doctor" && effectiveUserId === staff.practice_id;
  const isAdmin = effectiveRole === "admin";

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name: formData.fullName,
          phone: formData.phone,
        })
        .eq("id", staff.user_id);

      if (profileError) throw profileError;

      // Update practice_staff table timestamp
      const { error: staffError } = await supabase
        .from("practice_staff")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", staff.id);

      if (staffError) throw staffError;

      toast.success("Staff member updated successfully");
      setIsEditing(false);
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to update staff member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Staff Details</DialogTitle>
            <div className="flex items-center gap-2">
              <Badge variant={staff.active ? "default" : "secondary"}>
                {staff.active ? "Active" : "Inactive"}
              </Badge>
              {!isEditing && (isPractice || isAdmin) && (
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
          <div className="space-y-2">
            <Label>Practice</Label>
            <div className="p-2 bg-muted rounded-md">{staff.practice?.name || staff.practice?.company}</div>
          </div>

          <div className="space-y-2">
            <Label>Full Name</Label>
            {isEditing && (isPractice || isAdmin) ? (
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{staff.profiles?.full_name || staff.profiles?.name || 'N/A'}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <div className="p-2 bg-muted rounded-md">{staff.profiles?.email}</div>
          </div>

          <div className="space-y-2">
            <Label>Phone</Label>
            {isEditing ? (
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value })}
                placeholder="(555) 123-4567"
              />
            ) : (
              <div className="p-2 bg-muted rounded-md">{formData.phone || "N/A"}</div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role Type</Label>
            <div className="p-2 bg-muted rounded-md">
              <Badge variant="outline">{staff.role_type}</Badge>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ordering Privileges</Label>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div className="flex items-center gap-2">
                <Badge variant={staff.can_order ? "default" : "secondary"}>
                  {staff.can_order ? "Allowed" : "Restricted"}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Can place orders on behalf of practice
                </span>
              </div>
              {(isPractice || isAdmin) && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={staff.can_order}
                    onChange={async (e) => {
                      try {
                        const { error } = await supabase.functions.invoke('manage-staff-status', {
                          body: { staffId: staff.user_id, canOrder: e.target.checked }
                        });
                        if (error) throw error;
                        toast.success('Ordering privileges updated');
                        onSuccess();
                      } catch (error: any) {
                        toast.error('Failed to update privileges');
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                </label>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    fullName: staff.profiles?.full_name || staff.profiles?.name || "",
                    phone: staff.profiles?.phone ? staff.profiles.phone.replace(/\D/g, "") : "",
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
