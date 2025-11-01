import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClipboardList, Clock, Shield, Zap } from "lucide-react";

interface IntakeCompletionDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function IntakeCompletionDialog({
  open,
  onComplete,
}: IntakeCompletionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
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

        <DialogFooter>
          <Button onClick={onComplete} className="w-full">
            Complete Intake Form
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
