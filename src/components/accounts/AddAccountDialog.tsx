import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AddressInput } from "@/components/ui/address-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Upload, Check, ChevronsUpDown, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { validatePhone, validateNPI, validateDEA } from "@/lib/validators";
import { getCurrentCSRFToken } from "@/lib/csrf";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddAccountDialog = ({ open, onOpenChange, onSuccess }: AddAccountDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<string>("");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [toplineComboboxOpen, setToplineComboboxOpen] = useState(false);
  const [repComboboxOpen, setRepComboboxOpen] = useState(false);
  const [validationErrors, setValidationErrors] = useState({
    phone: "",
    npi: "",
    dea: "",
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    licenseNumber: "",
    npi: "",
    dea: "",
    contactEmail: "",
    statesServiced: [] as string[],
    priorityMap: {} as Record<string, number>,
    linkedToplineId: "",
  });

  // Fetch topline reps for downline role assignment
  const { data: toplineReps } = useQuery({
    queryKey: ["topline-reps"],
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
    enabled: role === "downline" || role === "doctor",
  });

  // Fetch downline reps for practice assignment
  const { data: downlineReps } = useQuery({
    queryKey: ["downline-reps"],
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
    enabled: role === "doctor",
  });

  // Combine and sort all reps for practice assignment
  const allReps = role === "doctor" 
    ? [...(toplineReps || []), ...(downlineReps || [])].sort((a, b) => a.name.localeCompare(b.name))
    : toplineReps || [];

  const handleStateToggle = (state: string) => {
    setFormData((prev) => ({
      ...prev,
      statesServiced: prev.statesServiced.includes(state)
        ? prev.statesServiced.filter((s) => s !== state)
        : [...prev.statesServiced, state],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      let contractFileData = null;
      if (contractFile) {
        const base64 = await fileToBase64(contractFile);
        contractFileData = {
          name: contractFile.name,
          data: base64.split(",")[1],
          mimeType: contractFile.type,
        };
      }

      // Validate practice-specific fields
      if (role === "doctor") {
        const phoneResult = validatePhone(formData.phone);
        const npiResult = validateNPI(formData.npi);
        const deaResult = validateDEA(formData.dea);

        if (!phoneResult.valid || !npiResult.valid || !deaResult.valid) {
          setValidationErrors({
            phone: phoneResult.error || "",
            npi: npiResult.error || "",
            dea: deaResult.error || "",
          });
          toast.error("Please fix validation errors before submitting");
          setLoading(false);
          return;
        }
      }

      // Validate pharmacy has at least one state
      if (role === "pharmacy" && formData.statesServiced.length === 0) {
        toast.error("Please select at least one state that this pharmacy services");
        setLoading(false);
        return;
      }

      const roleData: any = {};
      // Note: "doctor" role represents Practice accounts in the database
      if (role === "doctor") {
        roleData.licenseNumber = formData.licenseNumber;
        roleData.npi = formData.npi;
        roleData.dea = formData.dea;
        roleData.company = formData.company;
        roleData.phone = formData.phone;
        roleData.address_street = formData.address_street;
        roleData.address_city = formData.address_city;
        roleData.address_state = formData.address_state;
        roleData.address_zip = formData.address_zip;
        roleData.linkedToplineId = formData.linkedToplineId || undefined;
      } else if (role === "pharmacy") {
        roleData.contactEmail = formData.contactEmail;
        roleData.statesServiced = formData.statesServiced;
        roleData.address_street = formData.address_street;
        roleData.address_city = formData.address_city;
        roleData.address_state = formData.address_state;
        roleData.address_zip = formData.address_zip;
        roleData.priorityMap = formData.priorityMap;
      } else if (role === "downline") {
        roleData.linkedToplineId = formData.linkedToplineId;
        roleData.company = formData.company;
        roleData.phone = formData.phone;
        roleData.address_street = formData.address_street;
        roleData.address_city = formData.address_city;
        roleData.address_state = formData.address_state;
        roleData.address_zip = formData.address_zip;
      } else if (role === "topline") {
        roleData.company = formData.company;
        roleData.phone = formData.phone;
        roleData.address_street = formData.address_street;
        roleData.address_city = formData.address_city;
        roleData.address_state = formData.address_state;
        roleData.address_zip = formData.address_zip;
      }

      // Get current admin user for parent_id
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch CSRF token
      const csrfToken = await getCurrentCSRFToken();
      if (!csrfToken) {
        toast.error("Session expired. Please refresh the page and try again.");
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.functions.invoke("assign-user-role", {
        body: {
          email: formData.email,
          name: formData.name,
          role,
          parentId: user?.id, // Set current admin as parent
          roleData,
          contractFile: contractFileData,
          csrfToken, // Include in body as fallback
        },
        headers: {
          'x-csrf-token': csrfToken
        }
      });

      if (error) throw new Error((data as any)?.error || error.message);

      toast.success(`Account created! Welcome email with login credentials sent to ${formData.email}`);
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
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
    setRole("");
    setContractFile(null);
    setToplineComboboxOpen(false);
    setRepComboboxOpen(false);
    setValidationErrors({ phone: "", npi: "", dea: "" });
    setFormData({
      name: "",
      email: "",
      company: "",
      phone: "",
      address_street: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      licenseNumber: "",
      npi: "",
      dea: "",
      contactEmail: "",
      statesServiced: [],
      priorityMap: {},
      linkedToplineId: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Account</DialogTitle>
          <DialogDescription>
            Create a new account by filling out the form below
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
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
              <Label htmlFor="role">Role *</Label>
              <Select value={role} onValueChange={setRole} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">Practice</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="topline">Topline Rep</SelectItem>
                  <SelectItem value="downline">Downline Rep</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Practice-specific fields (doctor role = Practice in database) */}
          {role === "doctor" && (
            <>
              <div className="grid grid-cols-2 gap-4">
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
                  <Label htmlFor="npi">Practice NPI # *</Label>
                  <Input
                    id="npi"
                    placeholder="1234567890 (10 digits)"
                    maxLength={10}
                    value={formData.npi}
                    onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                    onBlur={() => {
                      const result = validateNPI(formData.npi);
                      setValidationErrors({ ...validationErrors, npi: result.error || "" });
                    }}
                    className={validationErrors.npi ? "border-destructive" : ""}
                    required
                  />
                  {validationErrors.npi && (
                    <p className="text-sm text-destructive">{validationErrors.npi}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dea">Practice DEA #</Label>
                  <Input
                    id="dea"
                    placeholder="AB1234567 (2 letters + 7 digits)"
                    maxLength={9}
                    value={formData.dea}
                    onChange={(e) => setFormData({ ...formData, dea: e.target.value.toUpperCase() })}
                    onBlur={() => {
                      const result = validateDEA(formData.dea);
                      setValidationErrors({ ...validationErrors, dea: result.error || "" });
                    }}
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
                    placeholder="1234567890 (10 digits)"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '');
                      setFormData({ ...formData, phone: value });
                    }}
                    onBlur={() => {
                      const result = validatePhone(formData.phone);
                      setValidationErrors({ ...validationErrors, phone: result.error || "" });
                    }}
                    className={validationErrors.phone ? "border-destructive" : ""}
                    required
                  />
                  {validationErrors.phone && (
                    <p className="text-sm text-destructive">{validationErrors.phone}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  />
                </div>
              </div>

              <AddressInput
                label="Practice Address *"
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
                required
              />

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
                      {formData.linkedToplineId
                        ? allReps?.find((rep) => rep.id === formData.linkedToplineId)?.name
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
                                setFormData({ ...formData, linkedToplineId: rep.id });
                                setRepComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.linkedToplineId === rep.id ? "opacity-100" : "opacity-0"
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
                {formData.linkedToplineId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, linkedToplineId: "" })}
                  >
                    Clear selection
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Pharmacy-specific fields */}
          {role === "pharmacy" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={formData.contactEmail}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                  required
                  placeholder="Primary contact email for pharmacy"
                />
                <p className="text-xs text-muted-foreground">
                  This will be used as the login email for the pharmacy account
                </p>
              </div>

              <AddressInput
                label="Pharmacy Address *"
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
                required
              />

              <div className="space-y-2">
                <Label>States Serviced *</Label>
                <div className="grid grid-cols-5 gap-2 p-4 border border-border rounded-md max-h-48 overflow-y-auto">
                  {US_STATES.map((state) => (
                    <div key={state} className="flex items-center space-x-2">
                      <Checkbox
                        id={`state-${state}`}
                        checked={formData.statesServiced.includes(state)}
                        onCheckedChange={() => handleStateToggle(state)}
                      />
                      <Label htmlFor={`state-${state}`} className="text-sm cursor-pointer">
                        {state}
                      </Label>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {formData.statesServiced.length} state(s)
                </p>
              </div>

              {/* Priority Configuration Section */}
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                <Label>Priority Configuration by State</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Assign priority numbers for each serviced state (1 = highest priority)
                </p>
                
                {formData.statesServiced.length > 0 ? (
                  <div className="space-y-2">
                    {formData.statesServiced.map((state) => (
                      <div key={state} className="flex items-center gap-2">
                        <Badge variant="secondary" className="w-12 justify-center">{state}</Badge>
                        <Input
                          type="number"
                          min="1"
                          placeholder="Priority"
                          value={formData.priorityMap[state] || ""}
                          onChange={(e) => {
                            const priority = e.target.value ? parseInt(e.target.value) : null;
                            const newPriorityMap = { ...formData.priorityMap };
                            if (priority) {
                              newPriorityMap[state] = priority;
                            } else {
                              delete newPriorityMap[state];
                            }
                            setFormData({
                              ...formData,
                              priorityMap: newPriorityMap
                            });
                          }}
                          className="w-24"
                        />
                        <span className="text-xs text-muted-foreground">
                          {!formData.priorityMap[state] ? "Default (lowest)" : 
                           formData.priorityMap[state] === 1 ? "Highest priority" : 
                           `Priority ${formData.priorityMap[state]}`}
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
            </>
          )}

          {role === "downline" && (
            <div className="space-y-2">
              <Label htmlFor="linkedToplineId">Parent Topline Rep *</Label>
              <Popover open={toplineComboboxOpen} onOpenChange={setToplineComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={toplineComboboxOpen}
                    className="w-full justify-between"
                  >
                    {formData.linkedToplineId
                      ? toplineReps?.find((rep) => rep.id === formData.linkedToplineId)?.name
                      : "Select topline rep..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search topline reps..." />
                    <CommandList>
                      <CommandEmpty>No topline rep found.</CommandEmpty>
                      <CommandGroup>
                        {toplineReps?.map((rep) => (
                          <CommandItem
                            key={rep.id}
                            value={rep.name}
                            onSelect={() => {
                              setFormData({ ...formData, linkedToplineId: rep.id });
                              setToplineComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.linkedToplineId === rep.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{rep.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {rep.email}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById("contract")?.click()}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {contractFile ? contractFile.name : "Upload Contract"}
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
