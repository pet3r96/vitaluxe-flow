import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PrescriptionWriterDialog } from "@/components/products/PrescriptionWriterDialog";
import { useQuery } from "@tanstack/react-query";

interface QuickRefillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderLine: any;
  onSuccess: () => void;
}

export function QuickRefillDialog({ open, onOpenChange, orderLine, onSuccess }: QuickRefillDialogProps) {
  const { toast } = useToast();
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);
  const [showPrescriptionWriter, setShowPrescriptionWriter] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch practice details
  const { data: practice } = useQuery({
    queryKey: ["practice", orderLine?.order_id],
    queryFn: async () => {
      const { data: order } = await supabase
        .from("orders")
        .select("doctor_id")
        .eq("id", orderLine.order_id)
        .single();

      if (!order) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", order.doctor_id)
        .single();

      return data;
    },
    enabled: open && !!orderLine,
  });

  // Fetch provider details
  const { data: provider } = useQuery({
    queryKey: ["provider", orderLine?.provider_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("providers")
        .select("*")
        .eq("id", orderLine.provider_id)
        .single();

      return data;
    },
    enabled: open && !!orderLine?.provider_id,
  });

  // Fetch patient details
  const { data: patient } = useQuery({
    queryKey: ["patient", orderLine?.patient_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("*")
        .eq("id", orderLine.patient_id)
        .single();

      return data;
    },
    enabled: open && !!orderLine?.patient_id,
  });

  // Fetch product details
  const { data: product } = useQuery({
    queryKey: ["product", orderLine?.product_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", orderLine.product_id)
        .single();

      return data;
    },
    enabled: open && !!orderLine?.product_id,
  });

  const checkEligibility = async () => {
    setIsCheckingEligibility(true);
    try {
      const { data, error } = await supabase.rpc("check_refill_eligibility", {
        p_order_line_id: orderLine.id,
      });

      if (error) throw error;

      // Type guard to ensure data is an object
      if (typeof data === 'object' && data !== null) {
        setEligibility(data);

        if ('eligible' in data && data.eligible === true) {
          setShowPrescriptionWriter(true);
        }
      }
    } catch (error) {
      console.error("Error checking eligibility:", error);
      toast({
        title: "Error",
        description: "Failed to check refill eligibility. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCheckingEligibility(false);
    }
  };

  const handlePrescriptionGenerated = async (
    prescriptionUrl: string,
    customSig: string,
    customDosage: string,
    notes: string,
    signature: string,
    dispensingOption: "dispense_as_written" | "may_substitute",
    refillsAllowed: boolean,
    refillsTotal: number
  ) => {
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create new order
      const { data: newOrder, error: orderError } = await supabase
        .from("orders")
        .insert({
          doctor_id: practice?.id,
          total_amount: orderLine.price * orderLine.quantity,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Determine next refill number
      const nextRefillNumber = (orderLine.refills_total || 0) - (orderLine.refills_remaining || 0) + 1;

      // Create new order line
      const { data: newOrderLine, error: orderLineError } = await supabase
        .from("order_lines")
        .insert({
          order_id: newOrder.id,
          product_id: orderLine.product_id,
          quantity: orderLine.quantity,
          price: orderLine.price,
          patient_id: orderLine.patient_id,
          patient_name: orderLine.patient_name,
          patient_email: orderLine.patient_email,
          patient_phone: orderLine.patient_phone,
          patient_address: orderLine.patient_address,
          provider_id: orderLine.provider_id,
          destination_state: orderLine.destination_state,
          prescription_method: "written",
          prescription_url: prescriptionUrl,
          custom_dosage: customDosage,
          custom_sig: customSig,
          order_notes: notes,
          original_order_line_id: orderLine.id,
          is_refill: true,
          refill_number: nextRefillNumber,
          refills_allowed: refillsAllowed,
          refills_total: refillsTotal,
          refills_remaining: refillsTotal,
          status: "pending",
        })
        .select()
        .single();

      if (orderLineError) throw orderLineError;

      // Create refill tracking record
      const { error: refillError } = await supabase
        .from("prescription_refills")
        .insert({
          original_order_line_id: orderLine.id,
          new_order_line_id: newOrderLine.id,
          refill_number: nextRefillNumber,
          new_prescription_url: prescriptionUrl,
          new_refills_authorized: refillsTotal,
          refilled_by: user.id,
        });

      if (refillError) throw refillError;

      // Update original order line to decrement refills_remaining
      const { error: updateError } = await supabase
        .from("order_lines")
        .update({
          refills_remaining: (orderLine.refills_remaining || 0) - 1,
        })
        .eq("id", orderLine.id);

      if (updateError) throw updateError;

      toast({
        title: "Refill Created",
        description: "A new prescription order has been created successfully.",
      });

      setShowPrescriptionWriter(false);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error creating refill:", error);
      toast({
        title: "Error",
        description: "Failed to create refill order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (showPrescriptionWriter && product && practice && provider) {
    return (
      <PrescriptionWriterDialog
        open={showPrescriptionWriter}
        onOpenChange={setShowPrescriptionWriter}
        product={{
          ...product,
          quantity: orderLine.quantity,
        }}
        patient={patient || null}
        practice={practice}
        provider={provider}
        quantity={orderLine.quantity}
        onPrescriptionGenerated={handlePrescriptionGenerated}
      />
    );
  }

  return (
    <Dialog open={open && !showPrescriptionWriter} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Refill</DialogTitle>
        </DialogHeader>

        {!eligibility ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check if this prescription is eligible for a quick refill. The system will verify:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Refills were authorized on the original prescription</li>
              <li>Refills are still remaining</li>
              <li>Prescription is less than 6 months old</li>
              <li>Original order is completed or processing</li>
            </ul>
            <Button
              onClick={checkEligibility}
              disabled={isCheckingEligibility}
              className="w-full"
            >
              {isCheckingEligibility && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check Eligibility
            </Button>
          </div>
        ) : ('eligible' in eligibility && eligibility.eligible === true) ? (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <div className="space-y-2">
                <p className="font-medium">This prescription is eligible for refill!</p>
                <div className="text-sm space-y-1">
                  <p>Refills remaining: {'refills_remaining' in eligibility ? String(eligibility.refills_remaining) : 'N/A'}</p>
                  <p>Months since original: {'months_since_order' in eligibility ? String(eligibility.months_since_order) : 'N/A'}</p>
                </div>
                <p className="text-xs mt-2">
                  Click continue to generate a new prescription PDF and create the refill order.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Not eligible for refill</p>
              <p className="text-sm mt-1">{'reason' in eligibility ? String(eligibility.reason) : 'Unknown reason'}</p>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {eligibility && 'eligible' in eligibility && eligibility.eligible === true && (
            <Button onClick={() => setShowPrescriptionWriter(true)} disabled={isProcessing}>
              {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue to Prescription
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
