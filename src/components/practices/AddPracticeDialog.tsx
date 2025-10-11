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
import { AddressInput } from "@/components/ui/address-input";
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

interface AddPracticeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preAssignedRepId?: string; // Auto-assign to this rep and hide selector
}

export const AddPracticeDialog = ({ open, onOpenChange, onSuccess, preAssignedRepId }: AddPracticeDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [repComboboxOpen, setRepComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    npi: "",
    licenseNumber: "",
    dea: "",
    company: "",
    phone: "",
    address_street: "",
    address_city: "",
    address_state: "",
    address_zip: "",
    prescriberFullName: "",
    prescriberName: "",
    prescriberNpi: "",
    prescriberDea: "",
    prescriberLicense: "",
    prescriberPhone: "",
    selectedRepId: "",
  });

  // Fetch all topline and downline reps
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

      // Call edge function with hardcoded 'doctor' role
      const { data, error } = await supabase.functions.invoke("assign-user-role", {
        body: {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role: "doctor", // HARDCODED
          roleData: {
            npi: formData.npi,
            licenseNumber: formData.licenseNumber,
            dea: formData.dea,
            company: formData.company,
            phone: formData.phone,
            address_street: formData.address_street,
            address_city: formData.address_city,
            address_state: formData.address_state,
            address_zip: formData.address_zip,
            linkedToplineId: formData.selectedRepId || undefined,
          },
          prescriberData: {
            fullName: formData.prescriberFullName,
            prescriberName: formData.prescriberName,
            npi: formData.prescriberNpi,
            dea: formData.prescriberDea,
            licenseNumber: formData.prescriberLicense,
            phone: formData.prescriberPhone,
          },
          contractFile: contractFileData,
        },
      });

      if (error) throw error;

      toast.success("✅ Practice account created successfully");
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
      password: "",
      npi: "",
      licenseNumber: "",
      dea: "",
      company: "",
      phone: "",
      address_street: "",
      address_city: "",
      address_state: "",
      address_zip: "",
      prescriberFullName: "",
      prescriberName: "",
      prescriberNpi: "",
      prescriberDea: "",
      prescriberLicense: "",
      prescriberPhone: "",
      selectedRepId: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Practice</DialogTitle>
          <DialogDescription>
            Create a new practice account by filling out the form below
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
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="npi">Practice NPI # *</Label>
              <Input
                id="npi"
                value={formData.npi}
                onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                required
                placeholder="10-digit practice NPI"
                maxLength={10}
              />
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
                onChange={(e) => setFormData({ ...formData, dea: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company/Practice *</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
            </div>
          </div>

          <AddressInput
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

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-semibold">Default Prescriber Information</h3>
            <p className="text-sm text-muted-foreground">
              This information will be used for the primary prescriber account within this practice.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prescriberFullName">Prescriber Full Name *</Label>
                <Input
                  id="prescriberFullName"
                  value={formData.prescriberFullName}
                  onChange={(e) => setFormData({ ...formData, prescriberFullName: e.target.value })}
                  placeholder="Dr. John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescriberName">Prescriber Name *</Label>
                <Input
                  id="prescriberName"
                  value={formData.prescriberName}
                  onChange={(e) => setFormData({ ...formData, prescriberName: e.target.value })}
                  placeholder="Name on prescriptions"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescriberNpi">Prescriber NPI # *</Label>
                <Input
                  id="prescriberNpi"
                  value={formData.prescriberNpi}
                  onChange={(e) => setFormData({ ...formData, prescriberNpi: e.target.value })}
                  placeholder="10-digit individual NPI"
                  required
                  maxLength={10}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescriberDea">Prescriber DEA #</Label>
                <Input
                  id="prescriberDea"
                  value={formData.prescriberDea}
                  onChange={(e) => setFormData({ ...formData, prescriberDea: e.target.value })}
                  placeholder="DEA number (optional)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescriberLicense">Prescriber License # *</Label>
                <Input
                  id="prescriberLicense"
                  value={formData.prescriberLicense}
                  onChange={(e) => setFormData({ ...formData, prescriberLicense: e.target.value })}
                  placeholder="Medical license number"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prescriberPhone">Prescriber Phone</Label>
                <Input
                  id="prescriberPhone"
                  type="tel"
                  value={formData.prescriberPhone}
                  onChange={(e) => setFormData({ ...formData, prescriberPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

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
              Create Practice
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
