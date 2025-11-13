import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardList, Clock, Shield, Zap } from "lucide-react";
import { useState } from "react";

interface IntakeCompletionDialogProps {
  open: boolean;
  onComplete: () => void;
  onDismiss: (dontAskAgain: boolean) => void;
}

export function IntakeCompletionDialog({
  open,
  onComplete,
  onDismiss,
}: IntakeCompletionDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleDismiss = () => {
    onDismiss(dontAskAgain);
    setDontAskAgain(false); // Reset for next time dialog opens
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleDismiss();
      }
    }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Complete Your Medical Intake</DialogTitle>
          <DialogDescription>
            Help us provide you with the best care possible by completing your medical information.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Takes 5-10 minutes</h4>
              <p className="text-sm text-muted-foreground">
                Complete the form at your own pace
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">HIPAA Compliant & Secure</h4>
              <p className="text-sm text-muted-foreground">
                Your information is encrypted and protected
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Faster Appointments</h4>
              <p className="text-sm text-muted-foreground">
                Providers will have your history ready before your visit
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">Better Care Coordination</h4>
              <p className="text-sm text-muted-foreground">
                Share your medical vault securely with any provider
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Checkbox 
            id="dont-ask-again" 
            checked={dontAskAgain}
            onCheckedChange={(checked) => setDontAskAgain(checked === true)}
          />
          <label
            htmlFor="dont-ask-again"
            className="text-sm text-muted-foreground cursor-pointer select-none"
          >
            Don't ask me again
          </label>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button 
            variant="ghost" 
            onClick={handleDismiss}
            className="w-full sm:w-auto"
          >
            Remind Me Later
          </Button>
          <Button 
            onClick={onComplete} 
            className="w-full sm:w-auto"
          >
            Complete Intake Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
