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
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

interface ShareConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsent: () => void;
}

export function ShareConsentDialog({
  open,
  onOpenChange,
  onConsent,
}: ShareConsentDialogProps) {
  const [agreed, setAgreed] = useState(false);

  const handleContinue = () => {
    if (agreed) {
      onConsent();
      setAgreed(false); // Reset for next time
    }
  };

  const handleCancel = () => {
    setAgreed(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Patient Authorization for One-Time Access Link
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            VitaLuxe Services
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-semibold mb-1">Important:</p>
              <p>This link will expire in <strong>1 hour</strong> and can only be used <strong>once</strong> for HIPAA compliance.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <p className="font-semibold">
              Purpose: You are requesting to generate a one-time access link to share your medical record from VitaLuxe Services. This link allows temporary access to your selected medical information for the recipient you choose.
            </p>
            
            <p className="font-semibold">Please read and agree to the following before continuing:</p>

            <ol className="space-y-2 list-decimal list-inside">
              <li>
                <strong>Authorization:</strong> I understand that by generating this link, I am authorizing VitaLuxe Services to release my selected medical information to the individual or organization I choose.
              </li>
              <li>
                <strong>Time Limit:</strong> I understand the link will expire automatically after 1 hour and cannot be reused, forwarded, or reissued without my consent.
              </li>
              <li>
                <strong>Responsibility:</strong> I understand that once this link is shared, VitaLuxe Services cannot control who accesses or uses the information during the valid time period.
              </li>
              <li>
                <strong>Revocation:</strong> I understand that this authorization will automatically expire after 1 hour, and I may revoke it earlier by contacting VitaLuxe Services support.
              </li>
              <li>
                <strong>Scope of Information:</strong> I understand that the link may include information such as my medical history, current medications, allergies, treatment notes, and clinical documents associated with my chart.
              </li>
              <li>
                <strong>Privacy Notice:</strong> I acknowledge that my information is protected under HIPAA and that this authorization is voluntary. My care, treatment, or access to services with VitaLuxe Services will not be affected by my choice to share or not share this information.
              </li>
              <li>
                <strong>Acknowledgment:</strong> By clicking "I Agree" or continuing, I confirm that I have read and understood this consent and authorize VitaLuxe Services to generate a one-time access link to my medical record.
              </li>
            </ol>
          </div>

          <div className="flex items-start space-x-2 pt-4 border-t">
            <Checkbox
              id="consent-checkbox"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <label
              htmlFor="consent-checkbox"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              I have read and agree to all of the above terms and authorize the creation of a one-time access link
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancel / Do Not Share
          </Button>
          <Button onClick={handleContinue} disabled={!agreed}>
            I Agree - Generate Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
