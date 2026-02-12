import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface RequestMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RequestMedicationDialog = ({
  open,
  onOpenChange,
}: RequestMedicationDialogProps) => {
  const { effectiveUserId, effectivePracticeId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    ingredients: "",
    description: "",
  });

  const resetForm = () => {
    setFormData({ name: "", dosage: "", ingredients: "", description: "" });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.dosage.trim() || !formData.ingredients.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!effectiveUserId) {
      toast.error("Unable to determine your user account");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("pending_product_requests").insert({
        name: formData.name.trim(),
        dosage: formData.dosage.trim(),
        ingredients: formData.ingredients.trim(),
        description: formData.description.trim() || null,
        created_by_user_id: effectiveUserId,
        practice_id: effectivePracticeId,
        request_source: "practice",
        status: "pending",
      });

      if (error) throw error;

      toast.success("Medication request submitted successfully! Our team will review it shortly.");
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) resetForm();
        onOpenChange(val);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request a Medication</DialogTitle>
          <DialogDescription>
            Don't see a product you need? Submit a request and our team will review it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="med_name">Medication Name *</Label>
            <Input
              id="med_name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Semaglutide"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="med_dosage">Dosage *</Label>
            <Input
              id="med_dosage"
              value={formData.dosage}
              onChange={(e) => setFormData({ ...formData, dosage: e.target.value })}
              placeholder="e.g. 2.5mg/0.5mL"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="med_ingredients">Ingredients Requested *</Label>
            <Textarea
              id="med_ingredients"
              value={formData.ingredients}
              onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
              placeholder="List the ingredients you need..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="med_notes">Additional Notes</Label>
            <Textarea
              id="med_notes"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Any other details..."
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !formData.name.trim() || !formData.dosage.trim() || !formData.ingredients.trim()}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
