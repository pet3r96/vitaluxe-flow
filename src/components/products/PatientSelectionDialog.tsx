import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface PatientSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onAddToCart: (patientId: string | null, quantity: number, shipToPractice: boolean, providerId: string) => void;
}

export const PatientSelectionDialog = ({
  open,
  onOpenChange,
  product,
  onAddToCart,
}: PatientSelectionDialogProps) => {
  const { effectiveUserId, effectiveRole } = useAuth();
  const navigate = useNavigate();
  const [shipTo, setShipTo] = useState<'patient' | 'practice'>('patient');
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from("patients" as any)
        .select("*")
        .eq("practice_id", effectiveUserId)
        .order("name");

      if (error) throw error;
      return data as any[] || [];
    },
    enabled: open && !!effectiveUserId,
  });

  // Fetch active providers for practice or provider themselves
  const { data: providers } = useQuery({
    queryKey: ["practice-providers", effectiveUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers" as any)
        .select("*")
        .eq("practice_id", effectiveUserId)
        .eq("active", true)
        .order("prescriber_name");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: open && !!effectiveUserId && effectiveRole === "doctor"
  });

  // Auto-select if only one provider
  useEffect(() => {
    if (providers && providers.length === 1 && !selectedProviderId) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  // If user is a provider, use their own ID
  useEffect(() => {
    if (effectiveRole === "provider" && effectiveUserId) {
      setSelectedProviderId(effectiveUserId);
    }
  }, [effectiveRole, effectiveUserId]);

  useEffect(() => {
    if (!open) {
      setShipTo('patient');
      setSelectedPatientId("");
      setQuantity(1);
      if (effectiveRole === "doctor") {
        setSelectedProviderId(null);
      }
    }
  }, [open, effectiveRole]);

  const handleAddToCart = () => {
    // Validate provider selection
    if (!selectedProviderId) {
      toast.error("Please select a provider");
      return;
    }

    if (shipTo === 'patient' && !selectedPatientId) {
      toast.error("Please select a patient");
      return;
    }

    if (quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }

    const isPracticeOrder = shipTo === 'practice';
    onAddToCart(
      isPracticeOrder ? null : selectedPatientId, 
      quantity,
      isPracticeOrder,
      selectedProviderId
    );
    onOpenChange(false);
  };

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);
  const showNoPatientWarning = shipTo === 'patient' && (!patients || patients.length === 0);
  const noActiveProviders = effectiveRole === "doctor" && providers && providers.length === 0;

  if (noActiveProviders) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>No Active Providers</DialogTitle>
            <DialogDescription>
              You need at least one active provider to place orders.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please add a provider from the Providers page before placing an order.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              navigate("/providers");
            }}>
              Go to Providers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (showNoPatientWarning) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>No Patients Found</DialogTitle>
            <DialogDescription>
              You need to add at least one patient before creating an order.
            </DialogDescription>
          </DialogHeader>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please add a patient from the Patients page to continue with your order.
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              navigate("/patients");
            }}>
              Go to Patients
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Product to Cart</DialogTitle>
          <DialogDescription>
            Product: {product?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Provider Selection for Practices */}
          {effectiveRole === "doctor" && providers && providers.length > 0 && (
            <div className="grid gap-3 pb-4 border-b">
              <Label className="text-base font-semibold">Select Provider *</Label>
              {providers.length === 1 ? (
                <div className="p-3 border rounded-md bg-muted">
                  <p className="text-sm font-medium">{providers[0].prescriber_name}</p>
                  <p className="text-xs text-muted-foreground">Provider NPI: {providers[0].npi}</p>
                </div>
              ) : (
                <RadioGroup value={selectedProviderId || ""} onValueChange={setSelectedProviderId}>
                  {providers.map((provider: any) => (
                    <div key={provider.id} className="flex items-center space-x-2 p-2 border rounded-md">
                      <RadioGroupItem value={provider.id} id={provider.id} />
                      <Label htmlFor={provider.id} className="flex-1 cursor-pointer">
                        <span className="font-medium">{provider.prescriber_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">NPI: {provider.npi}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          <div className="grid gap-3">
            <Label>Where would you like this shipped?</Label>
            <RadioGroup value={shipTo} onValueChange={(value) => setShipTo(value as 'patient' | 'practice')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="patient" id="patient" />
                <Label htmlFor="patient" className="font-normal cursor-pointer">
                  Ship to a Patient
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="practice" id="practice" />
                <Label htmlFor="practice" className="font-normal cursor-pointer">
                  Ship to My Practice
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="border-t pt-4 space-y-4">
            {shipTo === 'patient' ? (
              <div className="grid gap-2">
                <Label>Patient</Label>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={comboboxOpen}
                      className="justify-between"
                    >
                      {selectedPatient
                        ? `${selectedPatient.name} ${selectedPatient.birth_date ? `(DOB: ${format(new Date(selectedPatient.birth_date), "MM/dd/yyyy")})` : ""}`
                        : "Select patient..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search patients..." />
                      <CommandList>
                        <CommandEmpty>No patient found.</CommandEmpty>
                        <CommandGroup>
                          {patients?.map((patient) => (
                            <CommandItem
                              key={patient.id}
                              value={patient.name}
                              onSelect={() => {
                                setSelectedPatientId(patient.id);
                                setComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPatientId === patient.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{patient.name}</span>
                                {patient.birth_date && (
                                  <span className="text-xs text-muted-foreground">
                                    DOB: {format(new Date(patient.birth_date), "MM/dd/yyyy")}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  This product will be shipped to your practice address on file.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAddToCart}>
            {shipTo === 'practice' ? 'Add to Practice Order' : 'Add to Cart'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
