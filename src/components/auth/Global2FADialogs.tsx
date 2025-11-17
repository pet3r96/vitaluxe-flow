import { useAuth } from "@/contexts/AuthContext";
import { Sms2FADialog } from "@/components/auth/Sms2FADialog";

/**
 * Global 2FA Dialog Manager
 * Renders 2FA dialogs globally so they appear immediately after sign-in on any route
 */
export const Global2FADialogs = () => {
  // Defensive check: only proceed if we have auth context
  let authData;
  try {
    authData = useAuth();
  } catch (error) {
    import('@/lib/logger').then(({ logger }) => {
      logger.warn('Auth context not available yet in Global2FADialogs');
    });
    return null;
  }

  const {
    user,
    mustChangePassword,
    isImpersonating,
    requires2FASetup,
    requires2FAVerify,
    user2FAPhone,
    twoFAStatusChecked,
  } = authData;

  // Early return if no user
  if (!user) {
    return null;
  }

  // Don't show dialogs if:
  // - 2FA status hasn't been checked yet
  // - User is impersonating
  // - User must change password first
  // - Neither setup nor verify is required (2FA might be globally disabled)
  if (!twoFAStatusChecked || isImpersonating || mustChangePassword || (!requires2FASetup && !requires2FAVerify)) {
    return null;
  }

  // Show unified 2FA dialog for both setup and verify
  if ((requires2FASetup || requires2FAVerify) && user?.id) {
    import('@/lib/logger').then(({ logger }) => {
      logger.info('Rendering Sms2FADialog', { 
        requires2FASetup, 
        requires2FAVerify, 
        userId: user.id 
      });
    });
    return <Sms2FADialog open={true} userId={user.id} phone={user2FAPhone ?? undefined} />;
  }

  import('@/lib/logger').then(({ logger }) => {
    logger.info('No 2FA dialog needed', { 
      requires2FASetup, 
      requires2FAVerify, 
      twoFAStatusChecked 
    });
  });
  return null;
};
