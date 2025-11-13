import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

interface RepDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: any;
  onSuccess: () => void;
}

export const RepDetailsDialog = ({
  open,
  onOpenChange,
  rep,
  onSuccess,
}: RepDetailsDialogProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    name: rep.profiles?.name || "",
  });
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  // Fetch 2FA phone number
  const { data: twoFAPhone } = useQuery({
    queryKey: ["rep-2fa-phone", rep.user_id],
    queryFn: async () => {
      const { data: settings } = await supabase
        .from("user_2fa_settings")
        .select("phone_number_encrypted, is_enrolled, phone_verified")
        .eq("user_id", rep.user_id)
        .single();
      
      if (!settings || !settings.is_enrolled) return null;
      
      const { data: decrypted } = await supabase.rpc("decrypt_2fa_phone", {
        p_encrypted_phone: settings.phone_number_encrypted
      });
      
      return decrypted;
    },
    enabled: open && !!rep.user_id,
  });

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editedData.name,
        })
        .eq("id", rep.user_id);
      
      if (error) throw error;

      toast.success("Representative updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["all-representatives"] });
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to update: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData({
      name: rep.profiles?.name || "",
    });
    setIsEditing(false);
  };

  const formatPhoneNumber = (phone: string | null) => {
    if (!phone) return "-";
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Representative Details</DialogTitle>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.name}
                      onChange={(e) => setEditedData({ ...editedData, name: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{rep.profiles?.name || "-"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <p className="text-sm">{rep.profiles?.email || "-"}</p>
                </div>

                <div className="space-y-2">
                  <Label>Phone (2FA)</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">
                      {twoFAPhone ? formatPhoneNumber(twoFAPhone) : "Not Set"}
                    </p>
                    {!twoFAPhone && (
                      <Badge variant="secondary" className="text-xs">
                        Set during login
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Badge variant={rep.role === "topline" ? "default" : "secondary"}>
                    {rep.role === "topline" ? "Topline" : "Downline"}
                  </Badge>
                </div>

                {rep.role === "downline" && (
                  <div className="space-y-2">
                    <Label>Assigned To</Label>
                    <p className="text-sm">
                      {rep.topline_rep?.profiles?.name || "Unassigned"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Badge variant={rep.profiles?.active ? "default" : "secondary"}>
                    {rep.profiles?.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Created</Label>
                  <p className="text-sm">
                    {rep.created_at ? new Date(rep.created_at).toLocaleDateString() : "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
