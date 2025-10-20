import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { TwoFactorSetupDialog } from "@/components/auth/TwoFactorSetupDialog";
import { TwoFactorVerifyDialog } from "@/components/auth/TwoFactorVerifyDialog";

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { 
    user, 
    loading, 
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

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Redirect non-admin users who must change password
  useEffect(() => {
    if (!loading && user) {
      console.log('ProtectedRoute password check:', { 
        mustChangePassword, 
        effectiveRole, 
        pathname: location.pathname 
      });
      
      if (
        mustChangePassword &&
        effectiveRole !== 'admin' &&
        location.pathname !== '/change-password'
      ) {
        console.log('Redirecting to change-password');
        navigate("/change-password");
      }
    }
  }, [user, loading, mustChangePassword, effectiveRole, location.pathname, navigate]);

  // Redirect non-admin users who haven't accepted terms (after password change)
  useEffect(() => {
    if (!loading && user && !mustChangePassword && effectiveRole) {
      console.log('ProtectedRoute terms check:', { 
        termsAccepted, 
        effectiveRole, 
        pathname: location.pathname 
      });
      
      if (
        !termsAccepted &&
        effectiveRole !== 'admin' &&
        location.pathname !== '/accept-terms'
      ) {
        console.log('Redirecting to accept-terms');
        navigate("/accept-terms");
      }
    }
  }, [user, loading, mustChangePassword, termsAccepted, effectiveRole, location.pathname, navigate]);

  // Prevent admins from accessing the terms page (unless impersonating)
  useEffect(() => {
    if (!loading && user && effectiveRole === 'admin' && !isImpersonating && location.pathname === '/accept-terms') {
      navigate('/');
    }
  }, [loading, user, effectiveRole, isImpersonating, location.pathname, navigate]);

  if (loading) {
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

  // Show 2FA dialogs if needed (admins never need 2FA, even when impersonating)
  if (effectiveRole !== 'admin' && !isImpersonating) {
    if (requires2FASetup) {
      return <TwoFactorSetupDialog open={true} userId={user.id} />;
    }

    if (requires2FAVerify && user2FAPhone) {
      return <TwoFactorVerifyDialog open={true} phoneNumber={user2FAPhone} />;
    }
  }

  return <>{children}</>;
};
