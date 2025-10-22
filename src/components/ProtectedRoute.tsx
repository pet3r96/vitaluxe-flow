import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { GHLSmsSetupDialog } from "@/components/auth/GHLSmsSetupDialog";
import { GHLSmsVerifyDialog } from "@/components/auth/GHLSmsVerifyDialog";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { 
    user, 
    initializing, 
    mustChangePassword, 
    termsAccepted, 
    effectiveRole, 
    isImpersonating,
    requires2FASetup,
    requires2FAVerify,
    user2FAPhone
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // ===== ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS =====
  // This is critical to avoid "Rendered more hooks than during the previous render" error

  // Redirect if no user
  useEffect(() => {
    if (!initializing && !user) {
      navigate("/auth");
    }
  }, [user, initializing, navigate]);

  // Redirect non-admin users who must change password
  useEffect(() => {
    if (!initializing && user) {
      if (
        mustChangePassword &&
        effectiveRole !== 'admin' &&
        location.pathname !== '/change-password'
      ) {
        navigate("/change-password");
      }
    }
  }, [user, initializing, mustChangePassword, effectiveRole, location.pathname, navigate]);

  // Redirect non-admin users who haven't accepted terms (after password change)
  useEffect(() => {
    if (!initializing && user && !mustChangePassword && effectiveRole) {
      if (
        !termsAccepted &&
        effectiveRole !== 'admin' &&
        location.pathname !== '/accept-terms'
      ) {
        navigate("/accept-terms");
      }
    }
  }, [user, initializing, mustChangePassword, termsAccepted, effectiveRole, location.pathname, navigate]);

  // Prevent admins from accessing the terms page (unless impersonating)
  useEffect(() => {
    if (!initializing && user && effectiveRole === 'admin' && !isImpersonating && location.pathname === '/accept-terms') {
      navigate('/');
    }
  }, [initializing, user, effectiveRole, isImpersonating, location.pathname, navigate]);

  // ===== NOW SAFE TO HAVE CONDITIONAL RETURNS =====

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show GHL 2FA dialogs if needed (mandatory for ALL users including admins)
  // CHECK THIS BEFORE ROLE RESOLUTION to prevent getting stuck
  if (!isImpersonating) {
    if (requires2FASetup) {
      console.log('[ProtectedRoute] Rendering GHLSmsSetupDialog');
      return <GHLSmsSetupDialog open={true} userId={user.id} />;
    }

    if (requires2FAVerify && user2FAPhone) {
      console.log('[ProtectedRoute] Rendering GHLSmsVerifyDialog');
      return <GHLSmsVerifyDialog open={true} phoneNumber={user2FAPhone} userId={user.id} />;
    }
  }

  // While role is being determined, show a lightweight loader
  if (user && !effectiveRole) {
    console.log('[ProtectedRoute] Waiting for role resolution');
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground text-sm">Preparing your session...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
