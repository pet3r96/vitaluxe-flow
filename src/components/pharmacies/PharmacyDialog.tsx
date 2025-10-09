import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface PharmacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pharmacy: any | null;
  onSuccess: () => void;
}

export const PharmacyDialog = ({ open, onOpenChange, pharmacy, onSuccess }: PharmacyDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact_email: "",
    address: "",
    states_serviced: [] as string[],
  });

  useEffect(() => {
    if (pharmacy) {
      setFormData({
        name: pharmacy.name || "",
        contact_email: pharmacy.contact_email || "",
        address: pharmacy.address || "",
        states_serviced: pharmacy.states_serviced || [],
      });
    } else {
      resetForm();
    }
  }, [pharmacy]);

  const handleStateToggle = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      states_serviced: prev.states_serviced.includes(state)
        ? prev.states_serviced.filter((s) => s !== state)
        : [...prev.states_serviced, state],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const pharmacyData = {
        name: formData.name,
        contact_email: formData.contact_email,
        address: formData.address,
        states_serviced: formData.states_serviced,
        active: true,
      };

      if (pharmacy) {
        const { error } = await supabase
          .from("pharmacies")
          .update(pharmacyData)
          .eq("id", pharmacy.id);

        if (error) throw error;
        toast.success("Pharmacy updated successfully");
      } else {
        const { error } = await supabase.from("pharmacies").insert([pharmacyData]);

        if (error) throw error;
        toast.success("Pharmacy created successfully");
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save pharmacy");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      contact_email: "",
      address: "",
      states_serviced: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pharmacy ? "Edit Pharmacy" : "Add New Pharmacy"}</DialogTitle>
          <DialogDescription>
            {pharmacy ? "Update pharmacy information" : "Create a new pharmacy"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Pharmacy Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email *</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>States Serviced *</Label>
            <div className="grid grid-cols-5 gap-2 p-4 border border-border rounded-md max-h-48 overflow-y-auto">
              {US_STATES.map((state) => (
                <div key={state} className="flex items-center space-x-2">
                  <Checkbox
                    id={state}
                    checked={formData.states_serviced.includes(state)}
                    onCheckedChange={() => handleStateToggle(state)}
                  />
                  <Label htmlFor={state} className="text-sm cursor-pointer">
                    {state}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Selected: {formData.states_serviced.length} state(s)
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || formData.states_serviced.length === 0}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pharmacy ? "Update Pharmacy" : "Create Pharmacy"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
