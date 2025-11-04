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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, ChevronsUpDown, AlertCircle, Info, Upload, X, FileText, Loader2, FileCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PrescriptionWriterDialog } from "./PrescriptionWriterDialog";

interface PatientSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onAddToCart: (
    patientId: string | null, 
    quantity: number, 
    shipToPractice: boolean, 
    providerId: string, 
    prescriptionUrl?: string | null,
    customSig?: string | null,
    customDosage?: string | null,
    orderNotes?: string | null,
    prescriptionMethod?: string | null
  ) => void;
}

export const PatientSelectionDialog = ({
  open,
  onOpenChange,
  product,
  onAddToCart,
}: PatientSelectionDialogProps) => {
  const { effectiveUserId, effectiveRole, effectivePracticeId } = useAuth();
  const navigate = useNavigate();
  
  // Resolve practice ID from provider record if needed
  const { data: resolvedPracticeId, isLoading: isResolvingPractice } = useQuery({
    queryKey: ["provider-practice-id", effectiveUserId, effectiveRole],
    queryFn: async () => {
      if (effectiveRole !== 'provider' || !effectiveUserId) return effectivePracticeId;
      
      console.log('[PatientSelectionDialog] 🔄 Resolving practice ID for provider:', effectiveUserId);
      
      // For direct provider login, fetch their practice_id from providers table
      const { data, error } = await supabase
        .from("providers")
        .select("practice_id")
        .eq("user_id", effectiveUserId)
        .single();
      
      if (error) {
        console.error('[PatientSelectionDialog] ❌ Error fetching provider practice:', error);
        return effectivePracticeId;
      }
      
      console.log('[PatientSelectionDialog] ✅ Resolved practice ID:', data?.practice_id);
      return data?.practice_id || effectivePracticeId;
    },
    enabled: open && effectiveRole === 'provider',
    staleTime: 5 * 60 * 1000
  });
  
  const finalPracticeId = effectiveRole === 'provider' 
    ? (resolvedPracticeId || effectivePracticeId)
    : effectivePracticeId;
  
  console.log('[PatientSelectionDialog] 🎯 Practice context:', {
    effectiveRole,
    effectivePracticeId,
    resolvedPracticeId,
    finalPracticeId
  });
  
  const [currentStep, setCurrentStep] = useState<'details' | 'prescription'>('details');
  const [shipTo, setShipTo] = useState<'patient' | 'practice'>(effectiveRole === 'staff' ? 'practice' : 'patient');
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [prescriptionPreview, setPrescriptionPreview] = useState<string>("");
  const [uploadingPrescription, setUploadingPrescription] = useState(false);
  const [providerComboboxOpen, setProviderComboboxOpen] = useState(false);
  const [patientComboboxOpen, setPatientComboboxOpen] = useState(false);
  const [prescriptionMethod, setPrescriptionMethod] = useState<'upload' | 'written' | null>(null);
  const [showPrescriptionWriter, setShowPrescriptionWriter] = useState(false);
  const [customSig, setCustomSig] = useState("");
  const [customDosage, setCustomDosage] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [providerSignature, setProviderSignature] = useState("");

  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", finalPracticeId],
    queryFn: async () => {
      if (!finalPracticeId) return [];
      
      const { data, error } = await supabase
        .from("patient_accounts" as any)
        .select("*")
        .eq("practice_id", finalPracticeId)
        .order("name");

      if (error) throw error;
      
      // Filter out patients with incomplete data that would cause cart errors
      const validPatients = (data as any[] || []).filter((patient: any) => {
        const hasEmail = !!patient.email;
        const hasId = !!patient.id;
        return hasEmail && hasId;
      });
      
      return validPatients;
    },
    enabled: open && !!finalPracticeId,
  });

  // Helper to derive readable name from email
  const deriveNameFromEmail = (email: string): string => {
    const localPart = email.split('@')[0];
    return localPart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Fetch active providers for practice using backend function to avoid RLS issues
  const { data: providers } = useQuery({
    queryKey: ["practice-providers", finalPracticeId],
    queryFn: async () => {
      if (!finalPracticeId) {
        console.log('[PatientSelectionDialog] ⚠️ No practice ID, skipping provider fetch');
        return [];
      }
      
      try {
        console.log('[PatientSelectionDialog] 🔄 Fetching providers for practice:', finalPracticeId);
        const { data, error } = await supabase.functions.invoke('list-providers', {
          body: { practice_id: finalPracticeId }
        });
        
        if (error) {
          console.error('[PatientSelectionDialog] ❌ Error fetching providers:', error);
          throw error;
        }
        
        console.log('[PatientSelectionDialog] 🔍 Raw providers from list-providers:', data?.providers);
        
        return (data?.providers || []).map((p: any) => {
          // Priority 1: prescriber_name (if not empty)
          let displayName = p.profiles?.prescriber_name?.trim();
          
          // Priority 2: full_name (if not empty)
          if (!displayName) {
            displayName = p.profiles?.full_name?.trim();
          }
          
          // Priority 3: name field (but only if it's NOT an email)
          if (!displayName && p.profiles?.name && !p.profiles.name.includes('@')) {
            displayName = p.profiles.name.trim();
          }
          
          // Priority 4: Derive from email (last resort)
          if (!displayName && p.profiles?.name?.includes('@')) {
            displayName = deriveNameFromEmail(p.profiles.name);
          }
          
          // Final fallback
          if (!displayName) {
            displayName = 'Provider';
          }
          
          return {
            id: p.id,
            user_id: p.user_id,
            prescriber_name: displayName,
            specialty: '',
            npi: p.profiles?.npi || '',
            dea: p.profiles?.dea || '',
            profiles: p.profiles
          };
        });
      } catch (error) {
        console.error('Error fetching providers:', error);
        return [];
      }
    },
    enabled: open && !!finalPracticeId
  });

  // Auto-select provider based on role and available providers
  useEffect(() => {
    if (!open || !providers || providers.length === 0) return;
    
    console.log('[PatientSelectionDialog] 🎯 Auto-select logic:', {
      role: effectiveRole,
      userId: effectiveUserId,
      providersCount: providers.length,
      providers: providers
    });
    
    // For providers: find their own provider record
    if (effectiveRole === "provider" && effectiveUserId) {
      const matchingProvider = providers.find((p: any) => p.user_id === effectiveUserId);
      console.log('[PatientSelectionDialog] 🔎 Provider role matching:', {
        matchingProvider,
        selectedId: matchingProvider?.id
      });
      if (matchingProvider) {
        setSelectedProviderId(matchingProvider.id);
      }
    }
    // For doctors and staff: auto-select if only one provider
    else if ((effectiveRole === "doctor" || effectiveRole === "staff") && providers.length === 1) {
      setSelectedProviderId(providers[0].id);
    }
    // For doctors/staff with multiple providers: don't auto-select, let them choose
    else if ((effectiveRole === "doctor" || effectiveRole === "staff") && providers.length > 1 && !selectedProviderId) {
      setSelectedProviderId(null);
    }
  }, [open, providers, effectiveRole, effectiveUserId]);

  // Compute provider data locally from existing providers list (no RPC needed)
  const selectedProviderData = selectedProviderId 
    ? providers?.find((p: any) => p.id === selectedProviderId)
    : null;
  
  console.log('[PatientSelectionDialog] 📊 Selected provider data:', {
    selectedProviderId,
    selectedProviderData,
    providersAvailable: providers?.length
  });

  // Fetch practice details for prescription writer
  const { data: practiceData } = useQuery({
    queryKey: ["practice-details", finalPracticeId],
    queryFn: async () => {
      if (!finalPracticeId) {
        console.log('[PatientSelectionDialog] ⚠️ No practice ID for practice data fetch');
        return null;
      }
      
      console.log('[PatientSelectionDialog] 🔄 Fetching practice data for:', finalPracticeId);
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          name, 
          address_formatted, 
          address_street, 
          address_city, 
          address_state, 
          address_zip,
          shipping_address_formatted,
          shipping_address_street,
          shipping_address_city,
          shipping_address_state,
          shipping_address_zip
        `)
        .eq("id", finalPracticeId)
        .single();
      
      if (error) {
        console.error('[PatientSelectionDialog] ❌ Error fetching practice data:', error);
        throw error;
      }
      
      console.log('[PatientSelectionDialog] ✅ Practice data fetched:', data);
      return data;
    },
    enabled: !!finalPracticeId && open
  });

  useEffect(() => {
    if (!open) {
      // Reset all dialog state when closing
      setCurrentStep('details');
      setShipTo('patient');
      setSelectedPatientId("");
      setQuantity(1);
      setPrescriptionFile(null);
      setPrescriptionPreview("");
      setPrescriptionMethod(null);
      setCustomSig("");
      setCustomDosage("");
      setOrderNotes("");
      setProviderSignature("");
      setShowPrescriptionWriter(false);
      // Only reset provider selection when dialog closes
      if (effectiveRole === "doctor") {
        setSelectedProviderId(null);
      }
    }
  }, [open, effectiveRole]);

  const handlePrescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
      const validExtensions = ['.pdf', '.png', '.jpg', '.jpeg'];
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      
      // Check both MIME type and file extension for maximum compatibility
      if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
        toast.error(`File type not supported. Please upload a PDF or PNG/JPG file. Detected type: ${file.type || 'unknown'}`);
        return;
      }
      
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      
      setPrescriptionFile(file);
      toast.success("Prescription file uploaded successfully");
      
      if (file.type.startsWith('image/') || fileExtension.match(/\.(png|jpg|jpeg)$/i)) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPrescriptionPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPrescriptionPreview("");
      }
    }
  };

  const handleContinue = () => {
    if (!selectedProviderId) {
      toast.error("Please select a provider");
      return;
    }

    // Only require patient selection when shipping to patient
    if (shipTo === 'patient' && !selectedPatientId) {
      toast.error("Please select a patient");
      return;
    }

    if (quantity < 1) {
      toast.error("Quantity must be at least 1");
      return;
    }
    
    // Initialize custom sig and dosage from product defaults
    if (product?.sig && !customSig) {
      setCustomSig(product.sig);
    }
    if (product?.dosage && !customDosage) {
      setCustomDosage(product.dosage);
    }
    
    setCurrentStep('prescription');
  };

  const handleAddToCart = async () => {
    // Capture prescription URL before any state changes or dialog closing
    const capturedPrescriptionPreview = prescriptionPreview;
    
    // Validate prescription requirements on Page 2
    if (product.requires_prescription && prescriptionMethod === null) {
      toast.error("Please select a prescription method");
      return;
    }
    
    if (product.requires_prescription && prescriptionMethod === 'upload' && !prescriptionFile) {
      toast.error("Please upload a prescription file");
      return;
    }
    
    if (product.requires_prescription && prescriptionMethod === 'written' && !capturedPrescriptionPreview) {
      toast.error("Please write and generate the prescription");
      return;
    }

    const isPracticeOrder = shipTo === 'practice';
    
    let prescriptionUrl = null;
    
    // If prescription was written, use the captured generated URL
    if (product.requires_prescription && prescriptionMethod === 'written' && capturedPrescriptionPreview) {
      prescriptionUrl = capturedPrescriptionPreview;
    }
    // If prescription was uploaded, upload the file
    else if (product.requires_prescription && prescriptionFile) {
      setUploadingPrescription(true);
      try {
        const fileExt = prescriptionFile.name.split(".").pop();
        const fileName = `${effectiveUserId}/${Date.now()}_${Math.random()}.${fileExt}`;
        
      const { error: uploadError } = await supabase.storage
        .from("prescriptions")
        .upload(fileName, prescriptionFile, {
          contentType: prescriptionFile.type
        });

      if (uploadError) {
        // Provide friendlier error message for MIME type issues
        if (uploadError.message?.toLowerCase().includes('mime type')) {
          throw new Error("This file type isn't allowed by the server. Allowed types: PDF, PNG, JPG.");
        }
        throw uploadError;
      }

        const { data: urlData, error: urlError } = await supabase.storage
          .from("prescriptions")
          .createSignedUrl(fileName, 31536000); // 1 year expiry

        if (urlError) throw urlError;

        prescriptionUrl = urlData.signedUrl;
        toast.success("Prescription uploaded successfully");
      } catch (error: any) {
        toast.error(error.message || "Failed to upload prescription");
        setUploadingPrescription(false);
        return;
      } finally {
        setUploadingPrescription(false);
      }
    }
    
    // Get the selected provider's user_id (not the provider record ID)
    const selectedProvider = providers?.find((p: any) => p.id === selectedProviderId);
    if (!selectedProvider?.user_id) {
      toast.error("Unable to find provider information. Please try again.");
      return;
    }
    
    // Add to cart - ProductsGrid expects user_id for routing
    onAddToCart(
      isPracticeOrder ? null : selectedPatientId, 
      quantity,
      isPracticeOrder,
      selectedProvider.user_id,
      prescriptionUrl,
      customSig || null,
      customDosage || null,
      orderNotes || null,
      prescriptionMethod || null
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
          <DialogTitle>
            {currentStep === 'details' ? 'Add Product to Cart' : 'Prescription Details'}
          </DialogTitle>
          <DialogDescription>
            {currentStep === 'details' ? `Product: ${product?.name}` : 'Complete prescription information'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* PAGE 1: Details Section */}
          {currentStep === 'details' && (
            <>
              {/* Provider Selection */}
              {providers && providers.length > 0 && (
                <div className={cn(
                  "grid gap-3 pb-4 border-b",
                  product?.requires_prescription && !selectedProviderId && providers.length > 1 && "border-amber-500/50 bg-amber-500/5 p-4 rounded-lg"
                )}>
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">Select Provider *</Label>
                    {product?.requires_prescription && !selectedProviderId && providers.length > 1 && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                        Required for Prescription
                      </Badge>
                    )}
                  </div>
                  
                  {/* Show radio button if provider is logged in OR only one provider exists */}
                  {(providers.length === 1 || 
                    (effectiveRole === 'provider' && selectedProviderId && 
                     providers.find(p => p.id === selectedProviderId))) ? (
                    <div className="grid gap-2">
                      <div className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            id="single-provider-radio"
                            checked={selectedProviderId === (providers.find(p => p.id === selectedProviderId)?.id || providers[0].id)}
                            onChange={() => setSelectedProviderId(providers[0].id)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor="single-provider-radio" 
                              className="font-semibold cursor-pointer block"
                            >
                              {providers.find(p => p.id === selectedProviderId)?.prescriber_name || providers[0].prescriber_name}
                            </Label>
                            {(() => {
                              const provider = providers.find(p => p.id === selectedProviderId) || providers[0];
                              return (
                                <>
                                  {provider.profiles?.email && (
                                    <p className="text-sm text-muted-foreground mt-1">
                                      {provider.profiles.email}
                                    </p>
                                  )}
                                  {provider.npi && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      NPI: {provider.npi}
                                    </p>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            Your Account
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This provider will be associated with the order
                      </p>
                    </div>
                  ) : (
                    // Multiple providers - use searchable combobox
                    <div className="grid gap-2">
                      <Popover open={providerComboboxOpen} onOpenChange={setProviderComboboxOpen} modal={true}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={providerComboboxOpen}
                            className="justify-between w-full"
                            type="button"
                          >
                            {selectedProviderId
                              ? providers.find(p => p.id === selectedProviderId)?.prescriber_name || "Select provider..."
                              : "Select provider..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent 
                          className="w-[400px] p-0 z-[100]" 
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                          <Command>
                            <CommandInput placeholder="Search providers..." className="h-9" />
                            <CommandList>
                              <CommandEmpty>No provider found.</CommandEmpty>
                              <CommandGroup>
                                {providers.map((provider: any) => (
                                  <CommandItem
                                    key={provider.id}
                                    value={`${provider.prescriber_name}-${provider.id}`}
                                    onSelect={() => {
                                      console.log('[PatientSelectionDialog] Provider selected:', provider.id);
                                      setSelectedProviderId(provider.id);
                                      setProviderComboboxOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedProviderId === provider.id ? "opacity-100" : "opacity-0"
                                      )}
                                    />
                                    <div className="flex flex-col flex-1">
                                      <span className="font-medium">{provider.prescriber_name}</span>
                                      {(provider.specialty || provider.npi) && (
                                        <span className="text-xs text-muted-foreground">
                                          {provider.specialty && `${provider.specialty}`}
                                          {provider.specialty && provider.npi && ` • `}
                                          {provider.npi && `NPI: ${provider.npi}`}
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
                      {selectedProviderId && selectedProviderData && (
                        <div className="text-xs text-muted-foreground p-2 bg-muted/30 rounded">
                          Selected: {selectedProviderData.prescriber_name}
                          {selectedProviderData.profiles?.email && (
                            <> • {selectedProviderData.profiles.email}</>
                          )}
                        </div>
                      )}
                    </div>
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
                    <Popover open={patientComboboxOpen} onOpenChange={setPatientComboboxOpen} modal={true}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={patientComboboxOpen}
                          className="justify-between w-full"
                          type="button"
                        >
                          {selectedPatient
                            ? `${selectedPatient.name} ${selectedPatient.birth_date ? `(DOB: ${format(new Date(selectedPatient.birth_date), "MM/dd/yyyy")})` : ""}`
                            : "Select patient..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent 
                        className="w-[400px] p-0 z-[100]" 
                        align="start"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <Command>
                          <CommandInput placeholder="Search patients..." className="h-9" />
                          <CommandList>
                            <CommandEmpty>No patient found.</CommandEmpty>
                            <CommandGroup>
                              {patients?.map((patient) => (
                                <CommandItem
                                  key={patient.id}
                                  value={`${patient.name}-${patient.id}`}
                                  onSelect={() => {
                                    setSelectedPatientId(patient.id);
                                    setPatientComboboxOpen(false);
                                  }}
                                  className="cursor-pointer"
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
            </>
          )}

          {/* PAGE 2: Prescription & Notes Section */}
          {currentStep === 'prescription' && (
            <>
              <div className="space-y-4">
                {/* Prescription Method Radio Buttons - Only for RX Required */}
                {product?.requires_prescription && (
                    <div className="grid gap-3 border-b pb-4">
                      <Label className="text-base font-semibold">Prescription Method *</Label>
                      <RadioGroup value={prescriptionMethod || ""} onValueChange={(value) => setPrescriptionMethod(value as 'upload' | 'written')}>
                        <div className="flex items-center space-x-2 p-3 border rounded-md">
                          <RadioGroupItem value="upload" id="upload" />
                          <Label htmlFor="upload" className="flex-1 cursor-pointer font-normal">
                            Upload Prescription File
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2 p-3 border rounded-md">
                          <RadioGroupItem value="written" id="written" />
                          <Label htmlFor="written" className="flex-1 cursor-pointer font-normal">
                            Write Prescription Now
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}

                {/* Editable SIG and Dosage Fields - Show for all orders */}
                {shipTo === 'patient' && (
                  <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                    <h3 className="font-semibold text-sm">Prescription Details</h3>
                    
              <div className="grid gap-2">
                <Label>Dosage Instructions</Label>
                <div className="px-3 py-2 bg-muted/50 border rounded-md text-sm">
                  {customDosage || product.dosage || 'Not specified'}
                </div>
                <p className="text-xs text-muted-foreground">
                  This value is from the product configuration
                </p>
              </div>

                    <div className="grid gap-2">
                      <Label htmlFor="sig-input">SIG - Directions for Use</Label>
                      <Textarea
                        id="sig-input"
                        placeholder="e.g., Take 1 tablet by mouth daily..."
                        value={customSig}
                        onChange={(e) => setCustomSig(e.target.value)}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Default from product: {product.sig || 'Not specified'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Order Notes */}
                <div className="grid gap-3">
                  <Label htmlFor="notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any special instructions or notes for this order..."
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Show upload input if upload method selected - Only for RX Required */}
                {product?.requires_prescription && prescriptionMethod === 'upload' && (
                    <div className="space-y-3 p-4 border-2 border-gold1/30 rounded-lg bg-gold1/10">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-5 w-5 text-gold1 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <Label className="text-base font-semibold text-gold1">
                            Upload Prescription File
                          </Label>
                          <p className="text-sm text-orange-700 mt-1">
                            Please upload a PDF or PNG file (max 10MB).
                          </p>
                        </div>
                      </div>
                      
                      {prescriptionFile ? (
                        <div className="relative p-3 border rounded-md bg-white">
                          <div className="flex items-center gap-3">
                            {prescriptionPreview ? (
                              <img
                                src={prescriptionPreview}
                                alt="Prescription preview"
                                className="h-16 w-16 object-cover rounded"
                              />
                            ) : (
                              <div className="h-16 w-16 bg-muted rounded flex items-center justify-center">
                                <FileText className="h-8 w-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{prescriptionFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(prescriptionFile.size / 1024).toFixed(2)} KB
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPrescriptionFile(null);
                                setPrescriptionPreview("");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Input
                            id="prescription-upload"
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={handlePrescriptionChange}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById("prescription-upload")?.click()}
                            className="w-full border-gold1/30 hover:bg-gold1/10"
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Prescription (PDF or PNG)
                          </Button>
                        </>
                      )}
                      
                      {/* Removed redundant prescription summary - file card above shows upload success */}
                    </div>
                  )}

                {/* Show prescription writer button if write method selected - Only for RX Required */}
                {product?.requires_prescription && prescriptionMethod === 'written' && (
                    <div className="space-y-3">
                      {!selectedProviderData && (
                        <Alert className="border-amber-500/30 bg-amber-500/10">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <AlertDescription>
                            Please select a prescribing provider on the previous page to generate a prescription. Click "Back" to select a provider.
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      {(isResolvingPractice || (!practiceData && selectedProviderData)) && (
                        <Alert className="border-blue-500/30 bg-blue-500/10">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                          <AlertDescription>
                            {isResolvingPractice 
                              ? "Resolving provider information..." 
                              : "Practice information is loading. Please wait a moment before generating the prescription."}
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-full">
                              <Button 
                                variant="outline" 
                                onClick={() => {
                                  console.log('[PatientSelectionDialog] 🔍 Prescription Writer Button State:', {
                                    selectedProviderData: !!selectedProviderData,
                                    practiceData: !!practiceData,
                                    isResolvingPractice,
                                    selectedProviderId,
                                    finalPracticeId
                                  });
                                  setShowPrescriptionWriter(true);
                                }}
                                className="w-full"
                                disabled={!selectedProviderData || !practiceData || isResolvingPractice}
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                Open Prescription Writer
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {(!selectedProviderData || !practiceData || isResolvingPractice) && (
                            <TooltipContent>
                              <p>
                                {isResolvingPractice 
                                  ? "Resolving practice information..." 
                                  : !selectedProviderData 
                                    ? "Please select a provider first" 
                                    : "Waiting for practice information to load"}
                              </p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>

                      {/* Prescription Summary after generation */}
                      {prescriptionPreview && (
                        <Alert className="border-success/30 bg-success/10 dark:border-success/50 dark:bg-success/20">
                          <FileCheck className="h-4 w-4 text-success" />
                          <AlertDescription>
                            <div className="space-y-2">
                              <p className="font-semibold text-foreground">Prescription Generated</p>
                              <p className="text-sm text-muted-foreground"><strong>Dosage:</strong> {customDosage || product.dosage}</p>
                              <p className="text-sm text-muted-foreground"><strong>SIG:</strong> {customSig || product.sig}</p>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  )}
              </div>
            </>
          )}
        </div>

        {/* Prescription Writer Dialog */}
        {prescriptionMethod === 'written' && selectedProviderData && practiceData && (
          <PrescriptionWriterDialog
            open={showPrescriptionWriter}
            onOpenChange={setShowPrescriptionWriter}
            product={product}
            patient={shipTo === 'practice' ? null : selectedPatient}
            provider={{
              id: selectedProviderData.id,
              name: selectedProviderData.prescriber_name || 'Unknown',
              email: selectedProviderData.profiles?.email || 'N/A',
              npi: selectedProviderData.npi || 'N/A',
              dea: selectedProviderData.dea || 'N/A',
              license: selectedProviderData.profiles?.license_number || 'N/A'
            }}
            practice={{
              name: practiceData.name || 'Unknown Practice',
              address: practiceData.address_formatted || 'N/A'
            }}
            quantity={quantity}
            initialSig={customSig}
            initialDosage={customDosage}
            initialNotes={orderNotes}
            initialSignature={providerSignature}
            onPrescriptionGenerated={(url, sig, dosage, notes, signature, dispensingOpt) => {
              setPrescriptionPreview(url);
              setCustomSig(sig);
              setCustomDosage(dosage);
              if (notes) setOrderNotes(notes);
              setProviderSignature(signature);
              setShowPrescriptionWriter(false);
              toast.success("Prescription generated successfully");
            }}
          />
        )}

        <DialogFooter>
          {currentStep === 'prescription' && (
            <Button variant="ghost" onClick={() => setCurrentStep('details')}>
              ← Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          
          {currentStep === 'details' ? (
            <Button onClick={handleContinue}>
              {product?.requires_prescription ? 'Review Prescription' : 'Continue'}
            </Button>
          ) : (
            <Button 
              onClick={handleAddToCart}
              disabled={
                uploadingPrescription || 
                (product?.requires_prescription && !prescriptionFile && !prescriptionPreview)
              }
            >
              {uploadingPrescription ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Add to Cart'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
