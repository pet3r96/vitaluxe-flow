import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PharmacyDeclineDialogProps {
  orderId: string;
  orderNumber: string;
  onSuccess: () => void;
}

export const PharmacyDeclineDialog = ({ orderId, onSuccess }: PharmacyDeclineDialogProps) => {
  const [declineReason, setDeclineReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDecline = async () => {
    if (!declineReason) {
      toast.error('Please select a decline reason');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('pharmacy-decline-order', {
        body: {
          order_id: orderId,
          decline_reason: declineReason,
          additional_notes: additionalNotes.trim() || undefined,
        }
      });

      if (error) throw error;

      toast.success('Order declined and customer refunded successfully');
      setOpen(false);
      setDeclineReason("");
      setAdditionalNotes("");
      onSuccess();
    } catch (error: any) {
      console.error('Error declining order:', error);
      toast.error(error.message || 'Failed to decline order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-destructive">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          Decline Order
        </CardTitle>
        <CardDescription>
          This will cancel the order and automatically refund the customer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="reason">Decline Reason *</Label>
          <Select value={declineReason} onValueChange={setDeclineReason}>
            <SelectTrigger id="reason">
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="out_of_stock">Out of stock</SelectItem>
              <SelectItem value="cannot_fulfill">Cannot fulfill prescription</SelectItem>
              <SelectItem value="invalid_prescription">Invalid prescription</SelectItem>
              <SelectItem value="incorrect_dosage">Incorrect dosage</SelectItem>
              <SelectItem value="patient_request">Patient request</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Provide any additional context..."
            value={additionalNotes}
            onChange={(e) => setAdditionalNotes(e.target.value)}
            rows={3}
          />
        </div>

        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full" disabled={!declineReason}>
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
                  handleDecline();
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
      </CardContent>
    </Card>
  );
};
