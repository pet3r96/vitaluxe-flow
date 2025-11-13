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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentCSRFToken } from "@/lib/csrf";

interface AddRepresentativeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddRepresentativeDialog = ({ open, onOpenChange, onSuccess }: AddRepresentativeDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [toplineComboboxOpen, setToplineComboboxOpen] = useState(false);
  const [formData, setFormData] = useState({
    repType: "topline",
    name: "",
    email: "",
    assignedToplineId: "",
  });

  // Fetch topline reps for the dropdown (only if downline is selected)
  const { data: toplineReps } = useQuery({
    queryKey: ["topline-reps-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reps")
        .select(`
          id,
          user_id,
          profiles:user_id (
            id,
            name,
            email
          )
        `)
        .eq("role", "topline")
        .order("profiles(name)", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: open && formData.repType === "downline",
  });

  const resetForm = () => {
    setFormData({
      repType: "topline",
      name: "",
      email: "",
      assignedToplineId: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    if (!formData.name || !formData.email) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.repType === "downline" && !formData.assignedToplineId) {
      toast.error("Please select a topline rep for this downline");
      return;
    }

    setLoading(true);

    try {
      const csrfToken = await getCurrentCSRFToken();
      
      // Call edge function to create user with rep role
      const { data, error } = await supabase.functions.invoke("assign-user-role", {
        body: {
          email: formData.email,
          name: formData.name,
          role: formData.repType,
          roleData: {
            ...(formData.repType === "downline" && { 
              linkedToplineId: formData.assignedToplineId 
            }),
          },
        },
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      if (error) throw error;

      toast.success(`${formData.repType === "topline" ? "Topline" : "Downline"} representative added successfully`);
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error adding representative:", error);
      toast.error(error.message || "Failed to add representative");
    } finally {
      setLoading(false);
    }
  };

  const selectedToplineRep = toplineReps?.find(
    (rep) => rep.id === formData.assignedToplineId
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Representative</DialogTitle>
          <DialogDescription>
            Create a new topline or downline sales representative
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Rep Type Selection */}
          <div className="space-y-3">
            <Label>Representative Type *</Label>
            <RadioGroup
              value={formData.repType}
              onValueChange={(value) => setFormData({ ...formData, repType: value, assignedToplineId: "" })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="topline" id="topline" />
                <Label htmlFor="topline" className="font-normal cursor-pointer">
                  Topline Rep (Independent representative)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="downline" id="downline" />
                <Label htmlFor="downline" className="font-normal cursor-pointer">
                  Downline Rep (Reports to a topline rep)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Basic Information */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
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
                placeholder="john@example.com"
                required
              />
            </div>
          </div>

          {/* Conditional: Assign Topline (only for downlines) */}
          {formData.repType === "downline" && (
            <div className="space-y-2">
              <Label>Assigned Topline Rep *</Label>
              <Popover open={toplineComboboxOpen} onOpenChange={setToplineComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={toplineComboboxOpen}
                    className="w-full justify-between"
                  >
                    {selectedToplineRep?.profiles?.name || "Select topline rep..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search topline reps..." />
                    <CommandList>
                      <CommandEmpty>No topline reps found.</CommandEmpty>
                      <CommandGroup>
                        {toplineReps?.map((rep) => (
                          <CommandItem
                            key={rep.id}
                            value={rep.profiles?.name || ""}
                            onSelect={() => {
                              setFormData({ ...formData, assignedToplineId: rep.id });
                              setToplineComboboxOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.assignedToplineId === rep.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{rep.profiles?.name}</span>
                              <span className="text-xs text-muted-foreground">{rep.profiles?.email}</span>
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

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Representative
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
