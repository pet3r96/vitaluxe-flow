import { useAuth as useAuthContext } from "@/contexts/AuthContext";

/**
 * Thin hooks layer over AuthContext
 * Provides granular access to auth state without requiring full context
 */

export function useUser() {
  const { user } = useAuthContext();
  return user;
}

export function useRole() {
  const { userRole, effectiveRole, impersonatedRole } = useAuthContext();
  return { userRole, effectiveRole, impersonatedRole };
}

export function useSession() {
  const { session } = useAuthContext();
  return session;
}

export function useImpersonation() {
  const { 
    isImpersonating, 
    impersonatedUserName,
    canImpersonate,
    setImpersonation,
    clearImpersonation 
  } = useAuthContext();
  
  return {
    isImpersonating,
    impersonatedUserName,
    canImpersonate,
    setImpersonation,
    clearImpersonation
  };
}

export function useAuthStatus() {
  const { 
    loading, 
    initializing, 
    mustChangePassword, 
    termsAccepted,
    requires2FASetup,
    requires2FAVerify,
    passwordStatusChecked,
    twoFAStatusChecked
  } = useAuthContext();
  
  return {
    loading,
    initializing,
    mustChangePassword,
    termsAccepted,
    requires2FASetup,
    requires2FAVerify,
    passwordStatusChecked,
    twoFAStatusChecked
  };
}

export function useEffectiveUser() {
  const { effectiveUserId, effectiveRole, effectivePracticeId } = useAuthContext();
  return { effectiveUserId, effectiveRole, effectivePracticeId };
}

// Re-export the main hook for backward compatibility
export { useAuth } from "@/contexts/AuthContext";
