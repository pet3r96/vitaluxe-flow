import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCSRFToken, validateCSRFToken } from "@/lib/csrf";
import { AlertTriangle } from "lucide-react";

interface CancelOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  canCancel: boolean;
  isAdmin: boolean;
  orderCreatedAt: string;
  onSuccess: () => void;
}

export const CancelOrderDialog = ({
  open,
  onOpenChange,
  orderId,
  canCancel,
  isAdmin,
  orderCreatedAt,
  onSuccess,
}: CancelOrderDialogProps) => {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const timeRemaining = () => {
    if (isAdmin) return "No time limit (Admin)";
    
    const created = new Date(orderCreatedAt);
    const now = new Date();
    const hoursPassed = (now.getTime() - created.getTime()) / (1000 * 60 * 60);
    const minutesLeft = Math.max(0, Math.floor((1 - hoursPassed) * 60));
    
    return minutesLeft > 0 ? `${minutesLeft} minutes remaining` : "Time expired";
  };

  const handleCancel = async () => {
    setIsSubmitting(true);
    
    try {
      // Validate CSRF token before cancellation
      const csrfToken = getCSRFToken();
      if (!csrfToken) {
        throw new Error("Security token missing. Please refresh the page and try again.");
      }
      
      const isValid = await validateCSRFToken(csrfToken);
      if (!isValid) {
        throw new Error("Security token expired. Please refresh the page and try again.");
      }

      const { data, error } = await supabase.functions.invoke('cancel-order', {
        body: { orderId, reason, csrf_token: csrfToken }
      });

      if (error) throw error;

      toast({
        title: "Order Cancelled",
        description: "The order has been successfully cancelled.",
      });

      onSuccess();
      onOpenChange(false);
      setReason("");
    } catch (error: any) {
      console.error('Cancellation error:', error);
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cancel Order
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to cancel this order? This action cannot be undone.
            <div className="mt-2 text-sm text-muted-foreground">
              {timeRemaining()}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Cancellation Reason (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Explain why you're cancelling this order..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Keep Order
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={!canCancel || isSubmitting}
          >
            {isSubmitting ? "Cancelling..." : "Cancel Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
