import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeCompletionDialog } from "@/components/patient/IntakeCompletionDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logger } from '@/lib/logger';

/**
 * Global Intake Dialog Manager
 * Renders intake dialog globally so it appears immediately after patient sign-in on any route
 */
export const GlobalIntakeDialog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Defensive check: only proceed if we have auth context
  let authData;
  try {
    authData = useAuth();
  } catch (error) {
    logger.warn('[GlobalIntakeDialog] Auth context not available yet');
    return null;
  }

  const {
    userRole,
    effectiveUserId,
    showIntakeDialog,
    setShowIntakeDialog,
    mustChangePassword,
    termsAccepted,
    requires2FASetup,
    requires2FAVerify,
  } = authData;

  // Early return if no user ID
  if (!effectiveUserId) {
    return null;
  }

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
    !showIntakeDialog
  ) {
    return null;
  }

  const handleComplete = () => {
    logger.info('[GlobalIntakeDialog] Navigating to intake form');
    setShowIntakeDialog(false);
    navigate('/intake');
  };

  const handleDismiss = async (dontAskAgain: boolean) => {
    logger.info('[GlobalIntakeDialog] Dismissing dialog', { dontAskAgain });
    setShowIntakeDialog(false);

    if (dontAskAgain && effectiveUserId) {
      try {
        const { error } = await supabase.functions.invoke('dismiss-intake-reminder', {
          body: { userId: effectiveUserId }
        });

        if (error) {
          logger.error('[GlobalIntakeDialog] Error dismissing reminder', error);
          toast({
            title: "Error",
            description: "Failed to save preference. Please try again.",
            variant: "destructive"
          });
          return;
        }

        logger.info('[GlobalIntakeDialog] Intake reminder permanently dismissed');
        toast({
          title: "Preference Saved",
          description: "You won't see this reminder again.",
        });
      } catch (err) {
        logger.error('[GlobalIntakeDialog] Exception dismissing reminder', err);
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
