import { useAuth } from "@/contexts/AuthContext";
import { GHLSmsSetupDialog } from "@/components/auth/GHLSmsSetupDialog";
import { GHLSmsVerifyDialog } from "@/components/auth/GHLSmsVerifyDialog";

/**
 * Global 2FA Dialog Manager
 * Renders 2FA dialogs globally so they appear immediately after sign-in on any route
 */
export const Global2FADialogs = () => {
  const {
    user,
    mustChangePassword,
    isImpersonating,
    requires2FASetup,
    requires2FAVerify,
    user2FAPhone,
    twoFAStatusChecked,
  } = useAuth();

  // Don't show dialogs if:
  // - 2FA status hasn't been checked yet
  // - User is impersonating
  // - User must change password first
  if (!twoFAStatusChecked || isImpersonating || mustChangePassword) {
    return null;
  }

  // Show 2FA setup dialog if user needs to enroll
  if (requires2FASetup && user?.id) {
    console.log('[Global2FADialogs] Rendering SETUP dialog only', { 
      requires2FASetup, 
      requires2FAVerify, 
      userId: user.id 
    });
    return <GHLSmsSetupDialog open={true} userId={user.id} />;
  }

  // Show 2FA verification dialog if user needs to verify this session
  if (requires2FAVerify && user2FAPhone && user?.id) {
    console.log('[Global2FADialogs] Rendering VERIFY dialog only', { 
      requires2FASetup, 
      requires2FAVerify, 
      phone: user2FAPhone,
      userId: user.id 
    });
    return <GHLSmsVerifyDialog open={true} phoneNumber={user2FAPhone} userId={user.id} />;
  }

  console.log('[Global2FADialogs] No dialog needed', { 
    requires2FASetup, 
    requires2FAVerify, 
    twoFAStatusChecked 
  });
  return null;
};
