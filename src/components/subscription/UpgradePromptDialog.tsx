import { useUpgradePrompt } from "@/hooks/useUpgradePrompt";
import { UpgradeDialog } from "./UpgradeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

export const UpgradePromptDialog = () => {
  const { shouldShow, dismiss, dismissPermanently } = useUpgradePrompt();
  const [showFullDialog, setShowFullDialog] = useState(false);

  const handleLearnMore = () => {
    dismiss();
    setShowFullDialog(true);
  };

  const handleRemindLater = async () => {
    await dismiss();
  };

  const handleDontShow = async () => {
    await dismissPermanently();
  };

  return (
    <>
      <AlertDialog open={shouldShow && !showFullDialog} onOpenChange={(open) => !open && dismiss()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>✨ Upgrade to VitaLuxePro</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Transform your practice with our complete virtual front desk + EMR system.</p>
              <p className="font-semibold">
                <span className="text-2xl bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">$250</span>
                <span className="text-muted-foreground/70">/month</span>
                <span className="ml-2">• 7-Day Free Trial</span>
              </p>
              <p className="text-sm">
                Includes patient portal, appointment booking, secure messaging, digital charting, and more.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <AlertDialogAction onClick={handleLearnMore} className="w-full">
              Learn More
            </AlertDialogAction>
            <AlertDialogCancel onClick={handleRemindLater} className="w-full">
              Remind Me Later
            </AlertDialogCancel>
            <button
              onClick={handleDontShow}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              Don't Show Again
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeDialog open={showFullDialog} onOpenChange={setShowFullDialog} />
    </>
  );
};
