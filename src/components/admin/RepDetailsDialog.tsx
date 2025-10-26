import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { validatePhone } from "@/lib/validators";

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
    phone: rep.profiles?.phone || "",
    company: rep.profiles?.company || "",
  });
  const [validationErrors, setValidationErrors] = useState({ phone: "" });
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handlePhoneChange = (value: string) => {
    setEditedData({ ...editedData, phone: value });
    const phoneValidation = validatePhone(value);
    setValidationErrors({ phone: phoneValidation.error || "" });
  };

  const handleSave = async () => {
    if (editedData.phone && validationErrors.phone) {
      toast.error("Please fix validation errors");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: editedData.name,
          phone: editedData.phone,
          company: editedData.company,
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
      phone: rep.profiles?.phone || "",
      company: rep.profiles?.company || "",
    });
    setValidationErrors({ phone: "" });
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
                  <Label>Phone</Label>
                  {isEditing ? (
                    <>
                      <Input
                        value={editedData.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                      />
                      {validationErrors.phone && (
                        <p className="text-sm text-destructive">{validationErrors.phone}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm">{formatPhoneNumber(rep.profiles?.phone)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Company</Label>
                  {isEditing ? (
                    <Input
                      value={editedData.company}
                      onChange={(e) => setEditedData({ ...editedData, company: e.target.value })}
                    />
                  ) : (
                    <p className="text-sm">{rep.profiles?.company || "-"}</p>
                  )}
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
