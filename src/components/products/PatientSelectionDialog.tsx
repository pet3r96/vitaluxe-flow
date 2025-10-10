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
  onAddToCart: (patientId: string | null, quantity: number, shipToPractice: boolean) => void;
}

export const PatientSelectionDialog = ({
  open,
  onOpenChange,
  product,
  onAddToCart,
}: PatientSelectionDialogProps) => {
  const { effectiveUserId } = useAuth();
  const navigate = useNavigate();
  const [shipTo, setShipTo] = useState<'patient' | 'practice'>('patient');
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [comboboxOpen, setComboboxOpen] = useState(false);

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      
      const { data, error } = await supabase
        .from("patients" as any)
        .select("*")
        .eq("provider_id", effectiveUserId)
        .order("name");

      if (error) throw error;
      return data as any[] || [];
    },
    enabled: open && !!effectiveUserId,
  });

  useEffect(() => {
    if (!open) {
      setShipTo('patient');
      setSelectedPatientId("");
      setQuantity(1);
    }
  }, [open]);

  const handleAddToCart = () => {
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
      isPracticeOrder
    );
    onOpenChange(false);
  };

  const selectedPatient = patients?.find(p => p.id === selectedPatientId);
  const showNoPatientWarning = shipTo === 'patient' && (!patients || patients.length === 0);

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
