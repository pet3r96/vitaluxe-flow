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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNavigate } from "react-router-dom";

interface CancelSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscription: any;
}

export function CancelSubscriptionDialog({
  open,
  onOpenChange,
  subscription,
}: CancelSubscriptionDialogProps) {
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [canceling, setCanceling] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleCancel = async () => {
    if (!reason) {
      toast({
        title: "Reason Required",
        description: "Please select a reason for cancellation",
        variant: "destructive",
      });
      return;
    }

    try {
      setCanceling(true);
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: {
          subscription_id: subscription?.id,
          cancellation_reason: reason,
          feedback: feedback || null,
        }
      });

      if (error) throw error;

      toast({
        title: "Subscription Canceled",
        description: "Your subscription has been canceled. You'll have access until the end of your billing period.",
      });

      onOpenChange(false);
      
      // Refresh the page to update subscription status
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to cancel subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Subscription</DialogTitle>
          <DialogDescription>
            We're sorry to see you go. Your subscription will remain active until the end of your current billing period.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            After cancellation, you'll lose access to:
            <ul className="list-disc list-inside mt-2 text-sm">
              <li>Patient appointment booking</li>
              <li>Secure patient messaging</li>
              <li>Digital EMR & medical vault</li>
              <li>All VitaLuxePro premium features</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Cancellation *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="too_expensive">Too expensive</SelectItem>
                <SelectItem value="not_using">Not using the features</SelectItem>
                <SelectItem value="missing_features">Missing features I need</SelectItem>
                <SelectItem value="technical_issues">Technical issues</SelectItem>
                <SelectItem value="switching_provider">Switching to another provider</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback">Additional Feedback (Optional)</Label>
            <Textarea
              id="feedback"
              placeholder="Help us improve by sharing more details..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={canceling}
          >
            Keep Subscription
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={canceling || !reason}
          >
            {canceling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Canceling...
              </>
            ) : (
              'Cancel Subscription'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
