import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface PrescriptionWriterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  patient: any;
  provider: any;
  practice: any;
  quantity: number;
  initialSig?: string;
  initialDosage?: string;
  initialNotes?: string;
  initialSignature?: string;
  onPrescriptionGenerated: (prescriptionUrl: string, customSig: string, customDosage: string, notes: string, signature: string) => void;
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
  onPrescriptionGenerated,
}: PrescriptionWriterDialogProps) {
  const [customDosage, setCustomDosage] = useState(initialDosage || product?.dosage || "");
  const [customSig, setCustomSig] = useState(initialSig || product?.sig || "");
  const [notes, setNotes] = useState(initialNotes || "");
  const [signature, setSignature] = useState(initialSignature || "");
  const [isGenerating, setIsGenerating] = useState(false);

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

  // Show loading state if data is not ready
  if (!provider || !practice || !patient) {
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
      const { data, error } = await supabase.functions.invoke('generate-prescription-pdf', {
        body: {
          product_name: product.name,
          dosage: customDosage,
          sig: customSig,
          patient_name: patient.name,
          patient_dob: patient.birth_date ? format(new Date(patient.birth_date), 'MM/dd/yyyy') : null,
          patient_address: patient.address_formatted || patient.address,
          provider_name: provider.name,
          provider_npi: provider.npi,
          provider_dea: provider.dea,
          practice_name: practice.name,
          practice_address: practice.address_formatted || practice.address,
          date: format(new Date(), 'MM/dd/yyyy'),
          notes: notes,
          quantity: quantity,
          signature: signature
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success("Prescription generated successfully");
        onPrescriptionGenerated(data.prescription_url, customSig, customDosage, notes, signature);
        onOpenChange(false);
      } else {
        throw new Error(data?.error || "Failed to generate prescription");
      }
    } catch (error: any) {
      console.error('Error generating prescription:', error);
      
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
        console.error('Failed to log error:', logError);
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
              <p><strong>NPI:</strong> {provider.npi}</p>
              {provider.dea && <p><strong>DEA:</strong> {provider.dea}</p>}
            </div>
          </div>

          {/* Read-only Patient Info */}
          <div className="rounded-lg border bg-muted/50 p-4">
            <h3 className="font-semibold mb-2">Patient Information</h3>
            <div className="text-sm space-y-1 text-muted-foreground">
              <p><strong>Name:</strong> {patient.name}</p>
              {patient.birth_date && (
                <p><strong>Date of Birth:</strong> {format(new Date(patient.birth_date), 'MM/dd/yyyy')}</p>
              )}
              {patient.address_formatted && (
                <p><strong>Address:</strong> {patient.address_formatted}</p>
              )}
            </div>
          </div>

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