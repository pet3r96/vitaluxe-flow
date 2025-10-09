import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PatientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: any | null;
  onSuccess: () => void;
}

export const PatientDialog = ({
  open,
  onOpenChange,
  patient,
  onSuccess,
}: PatientDialogProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    dob: "",
    address: "",
    last_visit_date: "",
  });

  useEffect(() => {
    if (patient) {
      setFormData({
        full_name: patient.full_name || "",
        dob: patient.dob || "",
        address: patient.address || "",
        last_visit_date: patient.last_visit_date || "",
      });
    } else {
      resetForm();
    }
  }, [patient, open]);

  const resetForm = () => {
    setFormData({
      full_name: "",
      dob: "",
      address: "",
      last_visit_date: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.full_name.trim()) {
      toast.error("Patient name is required");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to manage patients");
      return;
    }

    setLoading(true);

    try {
      if (patient) {
        // Update existing patient
        const { error } = await supabase
          .from("patients" as any)
          .update({
            full_name: formData.full_name,
            dob: formData.dob || null,
            address: formData.address || null,
            last_visit_date: formData.last_visit_date || null,
          })
          .eq("id", patient.id);

        if (error) throw error;
        toast.success("Patient updated successfully");
      } else {
        // Create new patient
        const { error } = await supabase
          .from("patients" as any)
          .insert({
            provider_id: user.id,
            full_name: formData.full_name,
            dob: formData.dob || null,
            address: formData.address || null,
            last_visit_date: formData.last_visit_date || null,
          });

        if (error) throw error;
        toast.success("Patient added successfully");
      }

      onSuccess();
      resetForm();
    } catch (error: any) {
      console.error("Error saving patient:", error);
      toast.error(error.message || "Failed to save patient");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {patient ? "Edit Patient" : "Add New Patient"}
            </DialogTitle>
            <DialogDescription>
              {patient 
                ? "Update patient information below" 
                : "Enter patient details to add them to your records"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="dob">Date of Birth</Label>
              <Input
                id="dob"
                type="date"
                value={formData.dob}
                onChange={(e) =>
                  setFormData({ ...formData, dob: e.target.value })
                }
                max={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St, City, State ZIP"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="last_visit_date">Last Visit Date</Label>
              <Input
                id="last_visit_date"
                type="date"
                value={formData.last_visit_date}
                onChange={(e) =>
                  setFormData({ ...formData, last_visit_date: e.target.value })
                }
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : patient ? "Update Patient" : "Add Patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
