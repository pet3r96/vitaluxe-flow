import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, XCircle, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PharmacyOrderActionDialogProps {
  orderId: string;
  orderNumber: string;
  onSuccess: () => void;
}

export const PharmacyOrderActionDialog = ({ orderId, onSuccess }: PharmacyOrderActionDialogProps) => {
  const [action, setAction] = useState<'hold' | 'decline'>('hold');
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    if (action === 'hold' && !notes.trim()) {
      toast.error('Please provide detailed notes for placing order on hold');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('pharmacy-order-action', {
        body: {
          order_id: orderId,
          action: action,
          reason: reason,
          notes: notes.trim() || undefined,
        }
      });

      if (error) throw error;

      if (action === 'hold') {
        toast.success('Order placed on hold and support ticket created');
      } else {
        toast.success('Order declined and customer refunded successfully');
      }
      
      setConfirmDialogOpen(false);
      setAction('hold');
      setReason("");
      setNotes("");
      onSuccess();
    } catch (error: any) {
      console.error('Error processing order action:', error);
      toast.error(error.message || 'Failed to process order action');
    } finally {
      setIsSubmitting(false);
    }
  };

  const holdReasons = [
    { value: 'out_of_stock_temp', label: 'Out of Stock (Temporary)' },
    { value: 'awaiting_patient', label: 'Awaiting Patient Response' },
    { value: 'clarification_needed', label: 'Prescription Clarification Needed' },
    { value: 'incorrect_dosage_correction', label: 'Incorrect Dosage - Need Correction' },
    { value: 'other', label: 'Other' },
  ];

  const declineReasons = [
    { value: 'out_of_stock_permanent', label: 'Out of Stock (Permanent/Discontinued)' },
    { value: 'cannot_fulfill', label: 'Cannot Fulfill Prescription' },
    { value: 'invalid_prescription', label: 'Invalid Prescription' },
    { value: 'incorrect_dosage_permanent', label: 'Incorrect Dosage (Cannot Correct)' },
    { value: 'patient_cancelled', label: 'Patient Request Cancellation' },
    { value: 'other', label: 'Other' },
  ];

  const currentReasons = action === 'hold' ? holdReasons : declineReasons;

  return (
    <Card className="border-warning">
      <CardHeader>
        <CardTitle>Order Action Required</CardTitle>
        <CardDescription>
          Choose an action for this order
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Action Selection */}
        <div className="space-y-3">
          <Label>What would you like to do?</Label>
          <RadioGroup value={action} onValueChange={(v) => setAction(v as 'hold' | 'decline')}>
            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer">
              <RadioGroupItem value="hold" id="hold" />
              <div className="space-y-1 leading-none flex-1">
                <Label htmlFor="hold" className="cursor-pointer flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4" />
                  Put Order on Hold
                </Label>
                <p className="text-sm text-muted-foreground">
                  Temporary hold - no refund processed. Use when issue may be resolved.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-accent cursor-pointer">
              <RadioGroupItem value="decline" id="decline" />
              <div className="space-y-1 leading-none flex-1">
                <Label htmlFor="decline" className="cursor-pointer flex items-center gap-2 font-semibold">
                  <XCircle className="h-4 w-4" />
                  Decline and Refund Order
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permanent decline - full refund processed immediately. Cannot be undone.
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Reason Selection */}
        <div className="space-y-2">
          <Label htmlFor="reason">
            {action === 'hold' ? 'Hold Reason' : 'Decline Reason'} *
          </Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger id="reason">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              {currentReasons.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">
            {action === 'hold' ? 'Detailed Notes *' : 'Additional Notes'}
          </Label>
          <Textarea
            id="notes"
            placeholder={action === 'hold' 
              ? "Provide detailed information about the issue and what's needed to resolve it..."
              : "Provide any additional context..."
            }
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </div>

        {/* Info Alert */}
        {action === 'hold' ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will create a support ticket and notify the practice. No refund will be processed. 
              You can resume or decline the order later.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will immediately refund the customer and create a support ticket. This action cannot be undone.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Button */}
        {action === 'hold' ? (
          <Button 
            onClick={handleSubmit}
            disabled={!reason || isSubmitting}
            className="w-full"
            variant="outline"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Clock className="mr-2 h-4 w-4" />
                Place Order on Hold
              </>
            )}
          </Button>
        ) : (
          <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full" 
                disabled={!reason}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Decline & Refund Customer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirm Order Decline</AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>You are about to decline this order.</p>
                  <p className="font-semibold">This action will:</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>Mark the order as declined</li>
                    <li>Automatically refund the customer's payment</li>
                    <li>Create a support ticket</li>
                    <li>Notify the practice about the decline</li>
                    <li>Record the decline reason in the system</li>
                  </ul>
                  <p className="text-destructive font-semibold mt-4">This action cannot be undone.</p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                  disabled={isSubmitting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Confirm Decline & Refund'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardContent>
    </Card>
  );
};
