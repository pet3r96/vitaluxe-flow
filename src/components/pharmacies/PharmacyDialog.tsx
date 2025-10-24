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
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import { toast } from "sonner";
import { Loader2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCurrentCSRFToken } from "@/lib/csrf";

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
  const [toplineReps, setToplineReps] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    contact_email: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    states_serviced: [] as string[],
    priority_map: {} as Record<string, number>,
    scope_type: "global" as "global" | "scoped",
    assigned_topline_reps: [] as string[],
  });

  // Fetch topline reps
  useEffect(() => {
    const fetchToplineReps = async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          id,
          profiles:user_id (
            name,
            email
          )
        `)
        .eq("role", "topline");
      
      if (error) {
        import('@/lib/logger').then(({ logger }) => {
          logger.error("Error fetching topline reps", error);
        });
      }
      if (data) setToplineReps(data);
    };
    fetchToplineReps();
  }, []);

  // Fetch pharmacy assignments when editing
  useEffect(() => {
    const fetchAssignments = async () => {
      if (pharmacy) {
        const { data: assignments } = await supabase
          .from("pharmacy_rep_assignments")
          .select("topline_rep_id")
          .eq("pharmacy_id", pharmacy.id);
        
        const assignedReps = assignments?.map(a => a.topline_rep_id) || [];
        
        setFormData({
          name: pharmacy.name || "",
          contact_email: pharmacy.contact_email || "",
          address_street: pharmacy.address_street || "",
          address_city: pharmacy.address_city || "",
          address_state: pharmacy.address_state || "",
          address_zip: pharmacy.address_zip || "",
          states_serviced: pharmacy.states_serviced || [],
          priority_map: pharmacy.priority_map || {},
          scope_type: assignedReps.length > 0 ? "scoped" : "global",
          assigned_topline_reps: assignedReps,
        });
      } else {
        resetForm();
      }
    };
    fetchAssignments();
  }, [pharmacy]);

  const handleStateToggle = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      states_serviced: prev.states_serviced.includes(state)
        ? prev.states_serviced.filter((s) => s !== state)
        : [...prev.states_serviced, state],
    }));
  };

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(x => chars[x % chars.length]).join('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.states_serviced.length === 0) {
      toast.error("Please select at least one state that this pharmacy services");
      return;
    }

    setLoading(true);

    try {
      if (pharmacy) {
        // Update existing pharmacy
        const pharmacyData = {
          name: formData.name,
          contact_email: formData.contact_email,
          address_street: formData.address_street,
          address_city: formData.address_city,
          address_state: formData.address_state,
          address_zip: formData.address_zip,
          address: `${formData.address_street}, ${formData.address_city}, ${formData.address_state} ${formData.address_zip}`.trim(),
          states_serviced: formData.states_serviced,
          priority_map: formData.priority_map,
        };

        const { error } = await supabase
          .from("pharmacies")
          .update(pharmacyData)
          .eq("id", pharmacy.id);

        if (error) throw error;

        toast.success("Pharmacy updated successfully");
      } else {
        // Create new pharmacy with complete user account
        const tempPassword = generateSecurePassword();

        // Fetch CSRF token
        const csrfToken = await getCurrentCSRFToken();
        if (!csrfToken) {
          toast.error("Session expired. Please refresh the page and try again.");
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.functions.invoke('assign-user-role', {
          body: {
            email: formData.contact_email,
            password: tempPassword,
            name: formData.name,
            role: 'pharmacy',
            csrfToken, // Include in body as fallback
            roleData: {
              contactEmail: formData.contact_email,
              statesServiced: formData.states_serviced,
              address: `${formData.address_street}, ${formData.address_city}, ${formData.address_state} ${formData.address_zip}`.trim()
            }
          },
          headers: {
            'x-csrf-token': csrfToken
          }
        });

        if (error) throw new Error((data as any)?.error || error.message);

        // Update the pharmacy record with additional fields
        const { error: updateError } = await supabase
          .from("pharmacies")
          .update({
            address_street: formData.address_street,
            address_city: formData.address_city,
            address_state: formData.address_state,
            address_zip: formData.address_zip,
            priority_map: formData.priority_map,
          })
          .eq('contact_email', formData.contact_email)
          .eq('active', true);

        if (updateError) throw updateError;
        
        // Get the newly created pharmacy ID to set up scope assignments
        const { data: newPharmacy } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("contact_email", formData.contact_email)
          .single();

        toast.success(`Pharmacy created! Temporary password: ${tempPassword}`, {
          duration: 10000,
        });
        
        // Handle scope assignments for new pharmacy
        if (newPharmacy && formData.scope_type === "scoped" && formData.assigned_topline_reps.length > 0) {
          const assignments = formData.assigned_topline_reps.map(rep_id => ({
            pharmacy_id: newPharmacy.id,
            topline_rep_id: rep_id
          }));
          
          const { error: assignError } = await supabase
            .from("pharmacy_rep_assignments")
            .insert(assignments);
          
          if (assignError) throw assignError;
        }
      }
      
      // Handle scope assignments for existing pharmacy
      if (pharmacy) {
        // Delete existing assignments
        await supabase
          .from("pharmacy_rep_assignments")
          .delete()
          .eq("pharmacy_id", pharmacy.id);
        
        // Insert new assignments if scoped
        if (formData.scope_type === "scoped" && formData.assigned_topline_reps.length > 0) {
          const assignments = formData.assigned_topline_reps.map(rep_id => ({
            pharmacy_id: pharmacy.id,
            topline_rep_id: rep_id
          }));
          
          const { error: assignError } = await supabase
            .from("pharmacy_rep_assignments")
            .insert(assignments);
          
          if (assignError) throw assignError;
        }
      }

      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      import('@/lib/logger').then(({ logger }) => {
        logger.error("Error saving pharmacy", error);
      });
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
      scope_type: "global",
      assigned_topline_reps: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('.pac-container')) {
            e.preventDefault();
          }
        }}
      >
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

          <GoogleAddressAutocomplete
            label="Pharmacy Address"
            value={{
              street: formData.address_street,
              city: formData.address_city,
              state: formData.address_state,
              zip: formData.address_zip,
            }}
            onChange={(addressData) => {
              const newState = addressData.state || "";
              setFormData({
                ...formData,
                address_street: addressData.street,
                address_city: addressData.city,
                address_state: newState,
                address_zip: addressData.zip,
                // Auto-add home state to states_serviced if not already present
                states_serviced: newState && !formData.states_serviced.includes(newState)
                  ? [...formData.states_serviced, newState]
                  : formData.states_serviced,
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

          {/* Scope Assignment Section */}
          <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
            <Label className="text-base font-semibold">Scope Assignment</Label>
            <p className="text-sm text-muted-foreground">
              Control which topline rep groups can see and use this pharmacy
            </p>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <input
                  type="radio"
                  id="scope-global"
                  checked={formData.scope_type === "global"}
                  onChange={() => setFormData({ ...formData, scope_type: "global", assigned_topline_reps: [] })}
                  className="h-4 w-4"
                />
                <Label htmlFor="scope-global" className="cursor-pointer font-normal">
                  Available to All Reps (Global)
                </Label>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="scope-specific"
                    checked={formData.scope_type === "scoped"}
                    onChange={() => setFormData({ ...formData, scope_type: "scoped" })}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="scope-specific" className="cursor-pointer font-normal">
                    Assign to Specific Topline Rep(s)
                  </Label>
                </div>
                
                {formData.scope_type === "scoped" && (
                  <div className="ml-6 space-y-2 border rounded-md p-3 max-h-48 overflow-y-auto bg-background">
                    {toplineReps.map((rep) => (
                      <div key={rep.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`rep-${rep.id}`}
                          checked={formData.assigned_topline_reps.includes(rep.id)}
                          onCheckedChange={(checked) => {
                            setFormData({
                              ...formData,
                              assigned_topline_reps: checked
                                ? [...formData.assigned_topline_reps, rep.id]
                                : formData.assigned_topline_reps.filter(id => id !== rep.id)
                            });
                          }}
                        />
                        <Label htmlFor={`rep-${rep.id}`} className="text-sm cursor-pointer">
                          {rep.profiles.name} ({rep.profiles.email})
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {formData.scope_type === "scoped" && formData.assigned_topline_reps.length > 0 && (
              <Badge variant="secondary">
                Assigned to {formData.assigned_topline_reps.length} topline rep(s)
              </Badge>
            )}
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
