import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrialExpiredDialogProps {
  open: boolean;
  onUpgrade: () => void;
  onDecline: () => Promise<void>;
  status: 'trial' | 'active' | 'cancelled' | 'expired' | 'suspended' | 'payment_failed' | null;
  gracePeriodEndsAt?: Date | null;
  declining: boolean;
}

export const TrialExpiredDialog = ({ 
  open, 
  onUpgrade, 
  onDecline, 
  status,
  gracePeriodEndsAt,
  declining 
}: TrialExpiredDialogProps) => {
  const getTitle = () => {
    if (status === 'suspended' && gracePeriodEndsAt) {
      const daysRemaining = Math.ceil((gracePeriodEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return `Payment Required - ${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'} Remaining`;
    }
    return 'Your Trial Has Ended';
  };

  const getDescription = () => {
    if (status === 'suspended') {
      return 'Your payment method was declined. Please update your payment information to continue using VitaLuxePro.';
    }
    return 'To continue using VitaLuxePro features, please upgrade to a paid plan or cancel your subscription.';
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[500px]" 
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{getTitle()}</DialogTitle>
          <DialogDescription className="text-base">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        {status === 'suspended' && gracePeriodEndsAt && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Your account will be suspended if payment is not received within{' '}
              {Math.ceil((gracePeriodEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 pt-4">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">VitaLuxePro Benefits:</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>✓ Unlimited patient records</li>
              <li>✓ Advanced appointment scheduling</li>
              <li>✓ Video consultations</li>
              <li>✓ Custom branding</li>
              <li>✓ Priority support</li>
            </ul>
          </div>

          <div className="flex flex-col gap-3">
            <Button 
              onClick={onUpgrade} 
              size="lg"
              className="w-full"
            >
              {status === 'suspended' ? 'Update Payment Method' : 'Upgrade to Pro'}
            </Button>
            <Button 
              onClick={onDecline} 
              variant="outline" 
              size="lg"
              className="w-full"
              disabled={declining}
            >
              {declining ? 'Cancelling...' : 'Cancel Subscription'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            After upgrade: $99/month billed monthly
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
