import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { IntakeCompletionDialog } from "@/components/patient/IntakeCompletionDialog";

/**
 * Global Intake Dialog Manager
 * Renders intake dialog globally so it appears immediately after patient sign-in on any route
 */
export const GlobalIntakeDialog = () => {
  const navigate = useNavigate();
  const {
    userRole,
    effectiveUserId,
    showIntakeDialog,
    setShowIntakeDialog,
    mustChangePassword,
    requires2FASetup,
    requires2FAVerify,
  } = useAuth();

  // Don't show dialog if:
  // - Not a patient
  // - User must change password first
  // - User needs 2FA setup/verify first
  // - Dialog is not set to show
  if (
    userRole !== 'patient' ||
    mustChangePassword ||
    requires2FASetup ||
    requires2FAVerify ||
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

  return (
    <IntakeCompletionDialog 
      open={showIntakeDialog} 
      onComplete={handleComplete} 
    />
  );
};
