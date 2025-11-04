import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeCompletionDialog } from "@/components/patient/IntakeCompletionDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/**
 * Global Intake Dialog Manager
 * Renders intake dialog globally so it appears immediately after patient sign-in on any route
 */
export const GlobalIntakeDialog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    userRole,
    effectiveUserId,
    showIntakeDialog,
    setShowIntakeDialog,
    mustChangePassword,
    termsAccepted,
    requires2FASetup,
    requires2FAVerify,
  } = useAuth();

  // Don't show dialog if:
  // - Not a patient
  // - User must change password first
  // - User needs 2FA setup/verify first
  // - User hasn't accepted terms yet
  // - Dialog is not set to show
  if (
    userRole !== 'patient' ||
    mustChangePassword ||
    requires2FASetup ||
    requires2FAVerify ||
    !termsAccepted ||
    !showIntakeDialog ||
    !effectiveUserId
  ) {
    return null;
  }

  const handleComplete = () => {
    console.log('[GlobalIntakeDialog] Navigating to intake form');
    setShowIntakeDialog(false);
    navigate('/intake');
  };

  const handleDismiss = async (dontAskAgain: boolean) => {
    console.log('[GlobalIntakeDialog] Dismissing dialog', { dontAskAgain });
    setShowIntakeDialog(false);

    if (dontAskAgain && effectiveUserId) {
      try {
        const { error } = await supabase.functions.invoke('dismiss-intake-reminder', {
          body: { userId: effectiveUserId }
        });

        if (error) {
          console.error('[GlobalIntakeDialog] Error dismissing reminder:', error);
          toast({
            title: "Error",
            description: "Failed to save preference. Please try again.",
            variant: "destructive"
          });
          return;
        }

        console.log('[GlobalIntakeDialog] Intake reminder permanently dismissed');
        toast({
          title: "Preference Saved",
          description: "You won't see this reminder again.",
        });
      } catch (err) {
        console.error('[GlobalIntakeDialog] Exception dismissing reminder:', err);
      }
    }
  };

  return (
    <IntakeCompletionDialog 
      open={showIntakeDialog} 
      onComplete={handleComplete}
      onDismiss={handleDismiss}
    />
  );
};
