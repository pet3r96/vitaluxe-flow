import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { logPatientPHIAccess } from "@/lib/auditLogger";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

interface PrescriptionWriterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  patient: any | null;
  provider: any;
  practice: any;
  quantity: number;
  initialSig?: string;
  initialDosage?: string;
  initialNotes?: string;
  initialSignature?: string;
  initialDispensingOption?: "dispense_as_written" | "may_substitute";
  onPrescriptionGenerated: (
    prescriptionUrl: string, 
    customSig: string, 
    customDosage: string, 
    notes: string, 
    signature: string,
    dispensingOption: "dispense_as_written" | "may_substitute"
  ) => void;
}

export function PrescriptionWriterDialog({
  open,
  onOpenChange,
  product,
  patient,
  provider,
  practice,
  quantity,
  initialSig,
  initialDosage,
  initialNotes,
  initialSignature,
  initialDispensingOption,
  onPrescriptionGenerated,
}: PrescriptionWriterDialogProps) {
  const { effectiveRole } = useAuth();
  const [customDosage, setCustomDosage] = useState(initialDosage || product?.dosage || "");
  const [customSig, setCustomSig] = useState(initialSig || product?.sig || "");
  const [notes, setNotes] = useState(initialNotes || "");
  const [signature, setSignature] = useState(initialSignature || "");
  const [dispensingOption, setDispensingOption] = useState<"dispense_as_written" | "may_substitute">(
    initialDispensingOption || "dispense_as_written"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [decryptedAllergies, setDecryptedAllergies] = useState<string | null>(null);
  const [isLoadingAllergies, setIsLoadingAllergies] = useState(false);
  const [decryptedPrescriberCreds, setDecryptedPrescriberCreds] = useState<{ npi?: string; dea?: string; license_number?: string } | null>(null);
  const [isLoadingCreds, setIsLoadingCreds] = useState(false);

  const canViewPHI = ['doctor', 'provider', 'admin'].includes(effectiveRole || '');
  const canViewCredentials = ['admin', 'doctor', 'provider', 'pharmacy'].includes(effectiveRole || '');

  // Fetch and decrypt patient allergies when dialog opens
  useEffect(() => {
    const fetchDecryptedAllergies = async () => {
      if (!open || !patient?.id || !canViewPHI) {
        setDecryptedAllergies(null);
        return;
      }

      setIsLoadingAllergies(true);
      try {
        const { data, error } = await supabase.rpc('get_decrypted_patient_phi', {
          p_patient_id: patient.id
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setDecryptedAllergies(data[0].allergies);

          // Log PHI access
          const relationship = effectiveRole === 'admin' ? 'admin' : 
                             effectiveRole === 'doctor' ? 'practice_admin' : 
                             'provider';

          await logPatientPHIAccess({
            patientId: patient.id,
            patientName: patient.name,
            accessedFields: { allergies: true },
            viewerRole: effectiveRole || 'unknown',
            relationship,
            componentContext: 'PrescriptionWriterDialog'
          });
        }
      } catch (error) {
        logger.error('Failed to decrypt patient allergies', error, logger.sanitize({ patientId: patient.id }));
        setDecryptedAllergies(null);
      } finally {
        setIsLoadingAllergies(false);
      }
    };

    fetchDecryptedAllergies();
  }, [open, patient?.id, canViewPHI, effectiveRole]);

  // Fetch and decrypt prescriber credentials when dialog opens (for authorized roles)
  useEffect(() => {
    const fetchDecryptedCredentials = async () => {
      if (!open || !provider?.id || !canViewCredentials) {
        setDecryptedPrescriberCreds(null);
        return;
      }

      setIsLoadingCreds(true);
      try {
        const { data, error } = await supabase.rpc('get_decrypted_provider_credentials', {
          p_provider_id: provider.id
        });

        if (error) throw error;

        if (data && data.length > 0) {
          setDecryptedPrescriberCreds(data[0]);
        }
      } catch (error) {
        logger.error('Failed to decrypt prescriber credentials', error, logger.sanitize({ providerId: provider.id }));
        setDecryptedPrescriberCreds(null);
      } finally{
        setIsLoadingCreds(false);
      }
    };

    fetchDecryptedCredentials();
  }, [open, provider?.id, canViewCredentials]);

  // Sync state with prop changes
  useEffect(() => {
    setCustomDosage(initialDosage || product?.dosage || "");
  }, [initialDosage, product?.dosage]);

  useEffect(() => {
    setCustomSig(initialSig || product?.sig || "");
  }, [initialSig, product?.sig]);

  useEffect(() => {
    setNotes(initialNotes || "");
  }, [initialNotes]);

  useEffect(() => {
    setSignature(initialSignature || "");
  }, [initialSignature]);

  useEffect(() => {
    setDispensingOption(initialDispensingOption || "dispense_as_written");
  }, [initialDispensingOption]);

  // Show loading state if data is not ready (patient is optional for office dispensing)
  if (!provider || !practice) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Loading Prescription Details...
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 p-8">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Fetching prescriber and practice information...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleGenerate = async () => {
    if (!customSig.trim()) {
      toast.error("Please provide directions for use (SIG)");
      return;
    }

    if (!signature.trim()) {
      toast.error("Please provide your signature to complete the prescription");
      return;
    }

    setIsGenerating(true);
    try {
      // Calculate age from birth date
      const calculateAge = (birthDate: string) => {
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      };

      const { data, error } = await supabase.functions.invoke('generate-prescription-pdf', {
        body: {
          // Pass IDs instead of credentials for server-side decryption
          provider_id: provider.id,
          patient_id: patient?.id || null,
          
          // Non-sensitive data
          product_name: product.name,
          dosage: customDosage,
          sig: customSig,
          patient_name: patient ? patient.name : 'DISPENSING IN OFFICE ONLY',
          patient_dob: patient?.birth_date ? format(new Date(patient.birth_date), 'MM/dd/yyyy') : null,
          patient_age: patient?.birth_date ? calculateAge(patient.birth_date) : null,
          patient_address: patient ? (patient.address_formatted || patient.address) : null,
          patient_sex: null,
          is_office_dispensing: !patient,
          provider_name: provider.name,
          practice_name: practice.name,
          practice_address: practice.address_formatted || practice.address,
          date: format(new Date(), 'MM/dd/yyyy'),
          notes: notes,
          quantity: quantity,
          signature: signature,
          dispensing_option: dispensingOption,
          refills_allowed: false,
          refills_total: 0
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Prescription generated successfully");
        onPrescriptionGenerated(data.prescription_url, customSig, customDosage, notes, signature, dispensingOption);
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to generate prescription");
      }
    } catch (error: any) {
      // Log error to audit logs for admin visibility
      try {
        await supabase.functions.invoke('log-error', {
          body: {
            action_type: 'edge_function_error',
            entity_type: 'prescription_generation',
            details: {
              message: error.message || "Failed to generate prescription",
              error_type: error.name || 'Error',
              stack: error.stack,
              product_name: product.name,
              patient_name: patient.name,
              provider_name: provider.name,
              edge_function: 'generate-prescription-pdf',
              timestamp: new Date().toISOString(),
              url: window.location.href,
            }
          }
        });
      } catch (logError) {
        logger.error('Failed to log error to backend', logError);
      }
      
      toast.error(error.message || "Failed to generate prescription");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Digital Prescription Writer
          </DialogTitle>
          <DialogDescription>
            Complete the prescription details below. Fields are pre-populated from product information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Read-only Practice Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2">Practice Information</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Practice:</strong> {practice.name}</p>
              <p><strong>Address:</strong> {practice.address_formatted || practice.address}</p>
            </div>
          </div>

          {/* Read-only Provider Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2">Prescriber Information</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Provider:</strong> {provider.name}</p>
              {canViewCredentials && (
                <div className="pt-2 mt-2 border-t">
                  {isLoadingCreds ? (
                    <p className="text-xs italic flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading credentials...
                    </p>
                  ) : decryptedPrescriberCreds ? (
                    <>
                      {decryptedPrescriberCreds.npi && <p className="text-xs"><strong>NPI:</strong> {decryptedPrescriberCreds.npi}</p>}
                      {decryptedPrescriberCreds.dea && <p className="text-xs"><strong>DEA:</strong> {decryptedPrescriberCreds.dea}</p>}
                      {decryptedPrescriberCreds.license_number && <p className="text-xs"><strong>License:</strong> {decryptedPrescriberCreds.license_number}</p>}
                    </>
                  ) : (
                    <p className="text-xs italic">Unable to load credentials</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Patient Info - Show banner for office dispensing or patient details */}
          {patient ? (
            <div className="rounded-lg border bg-muted/50 p-4">
              <h3 className="font-semibold mb-2">Patient Information</h3>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p><strong>Name:</strong> {patient.name}</p>
                {patient.birth_date && (
                  <p><strong>Date of Birth:</strong> {format(new Date(patient.birth_date), 'MM/dd/yyyy')}</p>
                )}
                
                {/* Patient Allergies Display */}
                {canViewPHI && (
                  <div className="pt-2 border-t border-primary/30 mt-2">
                    <p className="text-xs font-semibold text-primary flex items-center gap-1 mb-1">
                      <AlertCircle className="h-3 w-3" />
                      Patient Allergies (PHI)
                    </p>
                    {isLoadingAllergies ? (
                      <p className="text-xs text-muted-foreground italic">Loading...</p>
                    ) : decryptedAllergies ? (
                      <p className="text-sm text-foreground bg-primary/10 p-2 rounded border border-primary/30">
                        {decryptedAllergies}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No known allergies recorded</p>
                    )}
                  </div>
                )}
                
                {patient.address_formatted && (
                  <p className="mt-2"><strong>Address:</strong> {patient.address_formatted}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-yellow-50 p-4">
              <h3 className="font-semibold mb-2 text-yellow-900">Office Dispensing</h3>
              <div className="text-sm space-y-1 text-yellow-800">
                <p className="font-bold text-lg">DISPENSING IN OFFICE ONLY</p>
                <p className="text-xs text-yellow-700">This prescription is for practice use. No patient-specific information required.</p>
              </div>
            </div>
          )}

          {/* Read-only Product Info */}
          <div className="rounded-lg border bg-accent/50 p-4">
            <h3 className="font-semibold mb-2">Product</h3>
            <div className="text-sm">
              <p className="font-medium">{product.name}</p>
              <p className="text-muted-foreground">Quantity: {quantity}</p>
            </div>
          </div>

          {/* Read-only Dosage */}
          <div className="grid gap-2">
            <Label htmlFor="dosage">Dosage Instructions</Label>
            <Input
              id="dosage"
              value={customDosage}
              readOnly
              className="bg-muted/50 cursor-not-allowed"
            />
          </div>

          {/* Editable SIG */}
          <div className="grid gap-2">
            <Label htmlFor="sig">SIG - Directions for Use *</Label>
            <Textarea
              id="sig"
              placeholder="e.g., Take 1 tablet by mouth daily, Apply to affected area twice daily, etc."
              value={customSig}
              onChange={(e) => setCustomSig(e.target.value)}
              rows={3}
              required
            />
            <p className="text-xs text-muted-foreground">
              These are the patient instructions for how to use this medication
            </p>
          </div>

          {/* Additional Notes */}
          <div className="grid gap-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any special instructions, warnings, or pharmacy notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Dispensing Option */}
          <div className="grid gap-3">
            <Label className="text-base font-semibold">Please Choose Applicable *</Label>
            <RadioGroup
              value={dispensingOption}
              onValueChange={(value) => setDispensingOption(value as "dispense_as_written" | "may_substitute")}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="dispense_as_written" id="dispense_as_written" />
                <Label 
                  htmlFor="dispense_as_written" 
                  className="cursor-pointer flex-1 font-medium"
                >
                  Dispense as Written
                  <p className="text-xs text-muted-foreground font-normal mt-1">
                    Pharmacist must dispense the exact brand/formulation prescribed
                  </p>
                </Label>
              </div>
              <div className="flex items-center space-x-3 border rounded-lg p-4 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="may_substitute" id="may_substitute" />
                <Label 
                  htmlFor="may_substitute" 
                  className="cursor-pointer flex-1 font-medium"
                >
                  May Substitute
                  <p className="text-xs text-muted-foreground font-normal mt-1">
                    Pharmacist may substitute with generic equivalent if available
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Signature */}
          <div className="grid gap-2">
            <Label htmlFor="signature" className="flex items-center gap-1">
              Provider Signature *
              <span className="text-xs text-muted-foreground font-normal">(Type your name to sign)</span>
            </Label>
            <Input
              id="signature"
              placeholder="Type your full name to electronically sign this prescription"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              required
              className="font-medium"
            />
            <p className="text-xs text-muted-foreground">
              By typing your name, you are electronically signing this prescription
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isGenerating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !customSig.trim() || !signature.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Prescription
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}