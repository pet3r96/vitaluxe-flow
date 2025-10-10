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
import { AddressInput } from "@/components/ui/address-input";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    states_serviced: [] as string[],
    priority_map: {} as Record<string, number>,
  });

  useEffect(() => {
    if (pharmacy) {
      setFormData({
        name: pharmacy.name || "",
        contact_email: pharmacy.contact_email || "",
        address_street: pharmacy.address_street || "",
        address_city: pharmacy.address_city || "",
        address_state: pharmacy.address_state || "",
        address_zip: pharmacy.address_zip || "",
        states_serviced: pharmacy.states_serviced || [],
        priority_map: pharmacy.priority_map || {},
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
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        states_serviced: formData.states_serviced,
        priority_map: formData.priority_map,
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
      address_street: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      states_serviced: [],
      priority_map: {},
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

          <AddressInput
            label="Pharmacy Address"
            value={{
              street: formData.address_street,
              city: formData.address_city,
              state: formData.address_state,
              zip: formData.address_zip,
            }}
            onChange={(addressData) => {
              setFormData({
                ...formData,
                address_street: addressData.street,
                address_city: addressData.city,
                address_state: addressData.state,
                address_zip: addressData.zip,
              });
            }}
          />

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

          {/* Priority Configuration Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <Label>Priority Configuration by State</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Assign priority numbers for each serviced state (1 = highest priority)
            </p>
            
            {formData.states_serviced.length > 0 ? (
              <div className="space-y-2">
                {formData.states_serviced.map((state) => (
                  <div key={state} className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-12 justify-center">{state}</Badge>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Priority"
                      value={formData.priority_map[state] || ""}
                      onChange={(e) => {
                        const priority = e.target.value ? parseInt(e.target.value) : null;
                        const newPriorityMap = { ...formData.priority_map };
                        if (priority) {
                          newPriorityMap[state] = priority;
                        } else {
                          delete newPriorityMap[state];
                        }
                        setFormData({
                          ...formData,
                          priority_map: newPriorityMap
                        });
                      }}
                      className="w-24"
                    />
                    <span className="text-xs text-muted-foreground">
                      {!formData.priority_map[state] ? "Default (lowest)" : 
                       formData.priority_map[state] === 1 ? "Highest priority" : 
                       `Priority ${formData.priority_map[state]}`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Select states serviced above to configure priority routing
                </AlertDescription>
              </Alert>
            )}
            
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded text-xs space-y-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Priority Routing Rules:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Priority 1 = Highest (orders go here first)</li>
                <li>Lower numbers = Higher priority</li>
                <li>If no priority set, pharmacy gets lowest priority for that state</li>
                <li>Only matters when multiple pharmacies serve same product + state</li>
              </ul>
            </div>
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
