import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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
import { GoogleAddressAutocomplete, type AddressValue } from "@/components/ui/google-address-autocomplete";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Loader2, Upload, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePhone, validateNPI, validateDEA } from "@/lib/validators";
import { getCurrentCSRFToken } from "@/lib/csrf";

interface AddPracticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preAssignedRepId?: string;
}

export const AddPracticeDialog = ({ open, onOpenChange, onSuccess, preAssignedRepId }: AddPracticeDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [repComboboxOpen, setRepComboboxOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
    npi: "",
    dea: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    npi: "",
    licenseNumber: "",
    dea: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    selectedRepId: "",
  });

  // Fetch topline reps
  const { data: toplineReps } = useQuery({
    queryKey: ["topline-reps-for-practices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "topline")
        .eq("active", true)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Fetch downline reps
  const { data: downlineReps } = useQuery({
    queryKey: ["downline-reps-for-practices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          name,
          email,
          user_roles!inner(role)
        `)
        .eq("user_roles.role", "downline")
        .eq("active", true)
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Combine both arrays and sort by name
  const allReps = [...(toplineReps || []), ...(downlineReps || [])].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  // Auto-set rep ID if preAssignedRepId is provided
  useState(() => {
    if (preAssignedRepId && open) {
      setFormData(prev => ({ ...prev, selectedRepId: preAssignedRepId }));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const phoneResult = validatePhone(formData.phone);
    const npiResult = validateNPI(formData.npi);
    const deaResult = formData.dea ? validateDEA(formData.dea) : { valid: true };

    if (!phoneResult.valid || !npiResult.valid || !deaResult.valid) {
      setValidationErrors({
        phone: phoneResult.error || "",
        npi: npiResult.error || "",
        dea: deaResult.error || "",
      });
      toast.error("Please fix validation errors before submitting");
      return;
    }
    
    setLoading(true);

    try {
      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', formData.email)
        .single();

      if (existingProfile) {
        toast.error("User already exists in the system. Please use a different email address.");
        setLoading(false);
        return;
      }
      
      // Upload contract if provided
      let contractFileData = null;
      if (contractFile) {
        const base64 = await fileToBase64(contractFile);
        contractFileData = {
          name: contractFile.name,
          data: base64.split(",")[1],
          mimeType: contractFile.type,
        };
      }

      // Fetch CSRF token
      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        toast.error("Session expired. Please refresh the page and try again.");
        setLoading(false);
        return;
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke("assign-user-role", {
        body: {
          email: formData.email,
          name: formData.name,
          role: "doctor", // Practice account role in database
          csrfToken, // Include in body as fallback
          roleData: {
            npi: formData.npi,
            licenseNumber: formData.licenseNumber,
            dea: formData.dea || undefined,
            phone: formData.phone,
            address_street: formData.address_street,
            address_city: formData.address_city,
            address_state: formData.address_state,
            address_zip: formData.address_zip,
            linkedToplineId: formData.selectedRepId || preAssignedRepId || undefined,
          },
          contractFile: contractFileData,
        },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) throw new Error((data as any)?.error || error.message);

      toast.success("✅ Practice account created! Welcome email with login credentials sent to " + formData.email);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(`❌ ${error.message || "Failed to create practice account"}`);
    } finally {
      setLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const resetForm = () => {
    setContractFile(null);
    setFormData({
      name: "",
      email: "",
      npi: "",
      licenseNumber: "",
      dea: "",
      phone: "",
      address_street: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      selectedRepId: "",
    });
    setValidationErrors({
      phone: "",
      npi: "",
      dea: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Practice</DialogTitle>
          <DialogDescription>
            Create a new practice account. Providers must be added separately after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Practice Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="npi">Practice NPI # *</Label>
              <Input
                id="npi"
                value={formData.npi}
                onChange={(e) => {
                  setFormData({ ...formData, npi: e.target.value });
                  setValidationErrors({ ...validationErrors, npi: "" });
                }}
                onBlur={() => {
                  const result = validateNPI(formData.npi);
                  setValidationErrors({ ...validationErrors, npi: result.error || "" });
                }}
                required
                placeholder="1234567890 (10 digits)"
                maxLength={10}
                className={validationErrors.npi ? "border-destructive" : ""}
              />
              {validationErrors.npi && (
                <p className="text-sm text-destructive">{validationErrors.npi}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="licenseNumber">Practice License # *</Label>
              <Input
                id="licenseNumber"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dea">Practice DEA #</Label>
              <Input
                id="dea"
                value={formData.dea}
                onChange={(e) => {
                  setFormData({ ...formData, dea: e.target.value.toUpperCase() });
                  setValidationErrors({ ...validationErrors, dea: "" });
                }}
                onBlur={() => {
                  const result = validateDEA(formData.dea);
                  setValidationErrors({ ...validationErrors, dea: result.error || "" });
                }}
                placeholder="AB1234567 (2 letters + 7 digits)"
                maxLength={9}
                className={validationErrors.dea ? "border-destructive" : ""}
              />
              {validationErrors.dea && (
                <p className="text-sm text-destructive">{validationErrors.dea}</p>
              )}
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
                  setValidationErrors({ ...validationErrors, phone: "" });
                }}
                onBlur={() => {
                  const result = validatePhone(formData.phone);
                  setValidationErrors({ ...validationErrors, phone: result.error || "" });
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
          </div>

          <GoogleAddressAutocomplete
            label="Practice Address"
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

          {!preAssignedRepId && (
            <div className="space-y-2">
              <Label htmlFor="assignedRep">Assigned Representative (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Assign a topline or downline rep to this practice. Leave blank if managed directly by admin.
              </p>
              <Popover open={repComboboxOpen} onOpenChange={setRepComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={repComboboxOpen}
                    className="w-full justify-between"
                  >
                    {formData.selectedRepId
                      ? allReps?.find((rep) => rep.id === formData.selectedRepId)?.name
                      : "Select representative (optional)..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search reps by name or email..." />
                    <CommandList>
                      <CommandEmpty>No representative found.</CommandEmpty>
                      <CommandGroup>
                        {allReps?.map((rep) => (
                          <CommandItem
                            key={rep.id}
                            value={`${rep.name} ${rep.email}`}
                            onSelect={() => {
                              setFormData({ ...formData, selectedRepId: rep.id });
                              setRepComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.selectedRepId === rep.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{rep.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {rep.email} • {rep.user_roles[0].role}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {formData.selectedRepId && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({ ...formData, selectedRepId: "" })}
                >
                  Clear selection
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="contract">Contract Document</Label>
            <div className="flex items-center gap-2">
              <Input
                id="contract"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setContractFile(e.target.files?.[0] || null)}
              />
              {contractFile && (
                <span className="text-sm text-muted-foreground">
                  {contractFile.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? "Creating..." : "Create Practice"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
