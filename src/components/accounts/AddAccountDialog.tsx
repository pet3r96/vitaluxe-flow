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
import { toast } from "sonner";
import { Loader2, Upload, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    phone: "",
    address: "",
    licenseNumber: "",
    npi: "",
    dea: "",
    contactEmail: "",
    statesServiced: [] as string[],
    linkedToplineId: "",
  });

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
    enabled: role === "downline",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let contractFileData = null;
      if (contractFile) {
        const base64 = await fileToBase64(contractFile);
        contractFileData = {
          name: contractFile.name,
          data: base64.split(",")[1],
          mimeType: contractFile.type,
        };
      }

      const roleData: any = {};
      if (role === "doctor") {
        roleData.licenseNumber = formData.licenseNumber;
        roleData.npi = formData.npi;
        roleData.dea = formData.dea;
        roleData.company = formData.company;
        roleData.phone = formData.phone;
        roleData.address = formData.address;
      } else if (role === "pharmacy") {
        roleData.contactEmail = formData.contactEmail;
        roleData.statesServiced = formData.statesServiced;
        roleData.address = formData.address;
      } else if (role === "downline") {
        roleData.linkedToplineId = formData.linkedToplineId;
        roleData.company = formData.company;
        roleData.phone = formData.phone;
        roleData.address = formData.address;
      } else if (role === "topline") {
        roleData.company = formData.company;
        roleData.phone = formData.phone;
        roleData.address = formData.address;
      }

      // Get current admin user for parent_id
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("assign-user-role", {
        body: {
          email: formData.email,
          password: formData.password,
          name: formData.name,
          role,
          parentId: user?.id, // Set current admin as parent
          roleData,
          contractFile: contractFileData,
        },
      });

      if (error) throw error;

      toast.success("Account created successfully");
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
    setFormData({
      name: "",
      email: "",
      password: "",
      company: "",
      phone: "",
      address: "",
      licenseNumber: "",
      npi: "",
      dea: "",
      contactEmail: "",
      statesServiced: [],
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
              <Label htmlFor="role">Role *</Label>
              <Select value={role} onValueChange={setRole} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="topline">Topline Rep</SelectItem>
                  <SelectItem value="downline">Downline Rep</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Role-specific fields */}
          {role === "doctor" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number *</Label>
                  <Input
                    id="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npi">NPI *</Label>
                  <Input
                    id="npi"
                    value={formData.npi}
                    onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dea">DEA</Label>
                  <Input
                    id="dea"
                    value={formData.dea}
                    onChange={(e) => setFormData({ ...formData, dea: e.target.value })}
                  />
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
