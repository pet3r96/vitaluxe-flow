import { ReactNode, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from '@/lib/logger';

interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { 
    user, 
    initializing, 
    mustChangePassword, 
    termsAccepted,
    passwordStatusChecked,
    effectiveRole, 
    isImpersonating,
    effectiveUserId,
    requires2FASetup,
    requires2FAVerify,
    user2FAPhone,
    twoFAStatusChecked
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Check for token-based password change (public access)
  const searchParams = new URLSearchParams(location.search);
  const hasToken = searchParams.has('token');
  
  // Allow public access to change-password with token
  if (location.pathname === '/change-password' && hasToken) {
    return <>{children}</>;
  }

  // ===== ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS =====
  // This is critical to avoid "Rendered more hooks than during the previous render" error

  // Redirect if no user
  useEffect(() => {
    if (!initializing && !user) {
      import('@/lib/logger').then(({ logger }) => {
        logger.info('Redirecting to /auth - no user');
      });
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
    if (!initializing && user && !mustChangePassword && effectiveRole && passwordStatusChecked) {
      import('@/lib/logger').then(({ logger }) => {
        logger.info('[TermsDebug - ProtectedRoute]', {
          termsAccepted,
          effectiveRole,
          effectiveUserId,
          mustChangePassword,
          passwordStatusChecked,
          currentPath: location.pathname,
          willRedirect: !termsAccepted && effectiveRole !== 'admin' && location.pathname !== '/accept-terms'
        });
      });
      
      if (
        !termsAccepted &&
        effectiveRole !== 'admin' &&
        location.pathname !== '/accept-terms'
      ) {
        // STRICT session check: Only bypass redirect if JUST accepted in this exact session
        const sessionKey = `vitaluxe_terms_ok_${effectiveUserId || user?.id}`;
        const sessionFlag = sessionStorage.getItem(sessionKey);
        const sessionTimestamp = sessionFlag ? parseInt(sessionFlag) : 0;
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        // Only skip redirect if accepted within last 5 minutes (same session navigation)
        if (sessionFlag && (now - sessionTimestamp) < fiveMinutes) {
          import('@/lib/logger').then(({ logger }) => {
            logger.info('[SECURITY] Terms accepted recently in session, allowing navigation', {
              sessionTimestamp,
              ageMs: now - sessionTimestamp
            });
          });
          return;
        }
        
        // Clear expired session flag
        if (sessionFlag) {
          sessionStorage.removeItem(sessionKey);
          import('@/lib/logger').then(({ logger }) => {
            logger.warn('[SECURITY] Session flag expired, cleared', { 
              ageMs: now - sessionTimestamp 
            });
          });
        }
        
        import('@/lib/logger').then(({ logger }) => {
          logger.info('[SECURITY] Redirecting to /accept-terms - terms not accepted', {
            effectiveRole,
            effectiveUserId,
            termsAccepted
          });
        });
        navigate("/accept-terms");
      }
    }
  }, [user, initializing, mustChangePassword, termsAccepted, effectiveRole, passwordStatusChecked, effectiveUserId, location.pathname, navigate]);

  // Prevent admins from accessing the terms page (unless impersonating)
  useEffect(() => {
    if (!initializing && user && effectiveRole === 'admin' && !isImpersonating && location.pathname === '/accept-terms') {
      navigate('/');
    }
  }, [initializing, user, effectiveRole, isImpersonating, location.pathname, navigate]);

  // Timeout failsafe for password status check (prevents infinite loading)
  useEffect(() => {
    if (user && effectiveRole && !passwordStatusChecked) {
      const timeout = setTimeout(() => {
        import('@/lib/logger').then(({ logger }) => {
          logger.warn('Password status check timeout after 10s');
        });
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [user, effectiveRole, passwordStatusChecked]);

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

  if (user && effectiveRole && !passwordStatusChecked) {
    import('@/lib/logger').then(({ logger }) => {
      logger.info('Waiting for password status check');
    });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground text-sm">Checking account status...</p>
        </div>
      </div>
    );
  }

  // Wait for 2FA status check to complete before rendering
  if (user && effectiveRole && !twoFAStatusChecked && !isImpersonating) {
    import('@/lib/logger').then(({ logger }) => {
      logger.info('Waiting for 2FA status check');
    });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-3 text-muted-foreground text-sm">Verifying security settings...</p>
        </div>
      </div>
    );
  }

  // Block access to protected content while 2FA is pending
  // The global Global2FADialogs component handles showing the actual dialog
  if (!isImpersonating && twoFAStatusChecked && !mustChangePassword) {
    if (requires2FASetup || requires2FAVerify) {
      import('@/lib/logger').then(({ logger }) => {
        logger.info('Blocking content - 2FA required');
      });
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
            <p className="mt-3 text-muted-foreground text-sm">Security verification required...</p>
          </div>
        </div>
      );
    }
  }

  // While role is being determined, show a lightweight loader
  if (user && !effectiveRole) {
    logger.info('[ProtectedRoute] Waiting for role resolution');
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
