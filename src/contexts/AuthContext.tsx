import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { generateCSRFToken, clearCSRFToken } from "@/lib/csrf";
import { logger } from "@/lib/logger";
// Idle timeout system removed - now using simple 60-minute hard session timeout
import { authService } from "@/lib/authService";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  initializing: boolean;
  actualRole: string | null;
  impersonatedRole: string | null;
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  isImpersonating: boolean;
  effectiveRole: string | null;
  effectiveUserId: string | null;
  effectivePracticeId: string | null;
  canImpersonate: boolean;
  isProviderAccount: boolean;
  mustChangePassword: boolean;
  termsAccepted: boolean;
  requires2FASetup: boolean;
  requires2FAVerify: boolean;
  user2FAPhone: string | null;
  twoFAStatusChecked: boolean;
  passwordStatusChecked: boolean;
  mark2FAVerified: () => void;
  checkPasswordStatus: (roleOverride?: string, userIdOverride?: string) => Promise<{ mustChangePassword: boolean; termsAccepted: boolean }>;
  setImpersonation: (role: string | null, userId?: string | null, userName?: string | null, targetEmail?: string | null) => void;
  clearImpersonation: () => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string, 
    password: string, 
    name: string, 
    role: string, 
    roleData: any,
    fullName?: string,
    prescriberName?: string
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

// Impersonation permissions are now managed via database
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);
  const [practiceParentId, setPracticeParentId] = useState<string | null>(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Only for critical operations (sign in/out)
  const [initializing, setInitializing] = useState(true); // Only for first-time bootstrap
  const [isProviderAccount, setIsProviderAccount] = useState(false);
  const [effectivePracticeId, setEffectivePracticeId] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [passwordStatusChecked, setPasswordStatusChecked] = useState(false);
  const [canImpersonateDb, setCanImpersonateDb] = useState(false);
  const [requires2FASetup, setRequires2FASetup] = useState(false);
  const [requires2FAVerify, setRequires2FAVerify] = useState(false);
  const [user2FAPhone, setUser2FAPhone] = useState<string | null>(null);
  const [twoFAStatusChecked, setTwoFAStatusChecked] = useState(false);
  const [is2FAVerifiedThisSession, setIs2FAVerifiedThisSession] = useState(false);
  
  // Hard 60-minute session timeout (no idle tracking)
  const HARD_SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
  const SESSION_EXP_KEY = 'vitaluxe_session_exp';
  const hardTimerRef = useRef<number | null>(null);
  
  const navigate = useNavigate();
  
  // Prevent double initial load
  const hasBootstrapped = useRef(false);

  const actualRole = userRole;
  const isImpersonating = impersonatedRole !== null;
  const effectiveRole = impersonatedRole || userRole;
  const effectiveUserId = impersonatedUserId || user?.id || null;
  const canImpersonate = userRole === 'admin' && canImpersonateDb;

  // Function to check GHL 2FA status
  const check2FAStatus = async (userId: string) => {
    console.log('[AuthContext] check2FAStatus - START for userId:', userId);
    
    try {
      // Query the decrypted view to get actual phone number instead of [ENCRYPTED]
      const { data, error } = await supabase
        .from('user_2fa_settings_decrypted')
        .select('ghl_enabled, ghl_phone_verified, phone_number, is_enrolled')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data || !data.ghl_enabled || !data.is_enrolled) {
        // Not enrolled in GHL 2FA - force setup
        console.log('[AuthContext] check2FAStatus - No 2FA record or not enabled, requires setup');
        setRequires2FASetup(true);
        setRequires2FAVerify(false);
        setUser2FAPhone(null);
      } else {
        // Always require verification on login
        console.log('[AuthContext] check2FAStatus - Enrolled, requires verification');
        setRequires2FAVerify(true);
        setRequires2FASetup(false);
        setUser2FAPhone(data.phone_number);
      }
      
      // Mark 2FA check as complete
      setTwoFAStatusChecked(true);
      console.log('[AuthContext] check2FAStatus - END, twoFAStatusChecked=true');
    } catch (error) {
      logger.error('Error checking GHL 2FA status', error);
      console.log('[AuthContext] check2FAStatus - ERROR, forcing setup');
      // On error, force setup to be safe
      setRequires2FASetup(true);
      setRequires2FAVerify(false);
      setTwoFAStatusChecked(true);
    }
  };

  // Bootstrap timeout failsafe - reduced from 15s to 8s
  useEffect(() => {
    const bootstrapTimeout = window.setTimeout(async () => {
      logger.warn('Auth bootstrap timeout (8s): attempting retry');
      
      // Try ONE more time to fetch role
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          await fetchUserRole(session.user.id);
          setInitializing(false);
          logger.info('Retry successful: role fetched');
          return;
        } catch (error) {
          logger.error('Retry failed:', error);
        }
      }
      
      // If retry fails, force clear and let ProtectedRoute handle redirect
      logger.error('Auth bootstrap failed after retry');
      setInitializing(false);
      setUserRole(null);
    }, 8000);

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        logger.info('Auth state changed', { event, hasSession: !!session });
        
        // Only update session state for meaningful auth events, NOT for token refresh
        if (event !== 'TOKEN_REFRESHED') {
          setSession(session);
          setUser(session?.user ?? null);
        }
        
        // Handle different auth events
        if (event === 'SIGNED_IN' && session?.user) {
          // Clear initializing immediately on successful sign in
          setInitializing(false);
          clearTimeout(bootstrapTimeout);
          
          // Set hard session expiration (60 minutes from now)
          const expireAt = Date.now() + HARD_SESSION_TIMEOUT_MS;
          localStorage.setItem(SESSION_EXP_KEY, String(expireAt));
          
          // Schedule hard timeout
          hardTimerRef.current = window.setTimeout(() => {
            void doHardSignOut();
          }, HARD_SESSION_TIMEOUT_MS);
          
          console.log('[AuthContext] SIGNED_IN - 60 minute timer started');
          
          // DEFER ALL SUPABASE CALLS TO PREVENT DEADLOCK
          setTimeout(() => {
            console.log('[AuthContext] Executing deferred backend calls');
            
            // Fetch role and CSRF token asynchronously (don't block)
            Promise.all([
              fetchUserRole(session.user.id),
              generateCSRFToken()
            ]).then(() => {
              logger.info('SIGNED_IN: user data loaded');
            }).catch((error) => {
              logger.error('Error loading user data after sign in', error);
            });
          }, 0);
          
        } else if (event === 'USER_UPDATED' && session?.user) {
          // User data updated - refresh role data silently (no loading state)
          setTimeout(() => {
            void fetchUserRole(session.user.id);
          }, 0);
          logger.info('USER_UPDATED: user data refreshed silently');
          
        } else if (event === 'SIGNED_OUT') {
          console.log('[AuthContext] ⚠️ SIGNED_OUT event received (source: auth-event)');
          
          // Clear hard timer
          if (hardTimerRef.current) {
            clearTimeout(hardTimerRef.current);
            hardTimerRef.current = null;
          }
          localStorage.removeItem(SESSION_EXP_KEY);
          
          // Clear all state on sign out
          setUserRole(null);
          setImpersonatedRole(null);
          setImpersonatedUserId(null);
          setImpersonatedUserName(null);
          setCurrentLogId(null);
          setTwoFAStatusChecked(false);
          setPasswordStatusChecked(false);
          setIs2FAVerifiedThisSession(false);
          sessionStorage.removeItem('vitaluxe_impersonation');
          
          // Clear 2FA verification cache on logout
          if (user?.id) {
            sessionStorage.removeItem(`vitaluxe_2fa_verified_${user.id}`);
            sessionStorage.removeItem(`vitaluxe_2fa_attempt_${user.id}`);
          }
          
          clearCSRFToken();
          logger.info('SIGNED_OUT: state cleared');
          
        } else if (event === 'TOKEN_REFRESHED') {
          // Do nothing - no need to refetch data or show loading
          logger.info('Token refreshed - no action needed');
          
        } else if (event === 'INITIAL_SESSION') {
          // Do nothing here - handled by getSession below
          logger.info('Initial session event - handled by getSession');
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      logger.info('Initial session check', { hasSession: !!session });
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Rehydrate 2FA verification status from sessionStorage
        const verifiedKey = `vitaluxe_2fa_verified_${session.user.id}`;
        const verifiedAt = sessionStorage.getItem(verifiedKey);
        
        if (verifiedAt) {
          setIs2FAVerifiedThisSession(true);
          logger.info('[AuthContext] Restored 2FA verification from sessionStorage');
        }
        
        // Check if hard session has expired
        const expireAt = localStorage.getItem(SESSION_EXP_KEY);
        
        if (expireAt) {
          const timeRemaining = parseInt(expireAt) - Date.now();
          
          if (timeRemaining <= 0) {
            // Session expired - force logout
            logger.warn('Session expired on page load');
            await doHardSignOut();
            setInitializing(false);
            clearTimeout(bootstrapTimeout);
            return;
          } else {
            // Session still valid - schedule remaining time
            logger.info('Session restored - scheduling remaining timeout', {
              minutesRemaining: (timeRemaining / 60000).toFixed(1)
            });
            hardTimerRef.current = window.setTimeout(() => {
              void doHardSignOut();
            }, timeRemaining);
          }
        } else {
          // No expiration found (shouldn't happen) - set fresh 60 minute timer
          logger.warn('No session expiration found - creating fresh timer');
          const expireAt = Date.now() + HARD_SESSION_TIMEOUT_MS;
          localStorage.setItem(SESSION_EXP_KEY, String(expireAt));
          hardTimerRef.current = window.setTimeout(() => {
            void doHardSignOut();
          }, HARD_SESSION_TIMEOUT_MS);
        }
        
        if (!hasBootstrapped.current) {
          hasBootstrapped.current = true;
          await fetchUserRole(session.user.id);
          await generateCSRFToken();
        }
      }
      
      setInitializing(false);
      clearTimeout(bootstrapTimeout);
      logger.info('Bootstrap complete: initializing cleared');
    }).catch((error) => {
      logger.error('Error during initial session check', error);
      setInitializing(false);
      clearTimeout(bootstrapTimeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(bootstrapTimeout);
      if (hardTimerRef.current) {
        clearTimeout(hardTimerRef.current);
      }
    };
  }, []);

  // Impersonation permission now checked in parallel during fetchUserRole - removed redundant useEffect

  // Check if current user is a provider account and compute practice ID
  useEffect(() => {
    const checkProviderStatusAndPractice = async () => {
      if (!effectiveUserId || !effectiveRole) {
        setIsProviderAccount(false);
        setEffectivePracticeId(null);
        return;
      }

      try {
        // If role is doctor (Practice account), practice ID is the user ID itself
        if (effectiveRole === 'doctor') {
          setEffectivePracticeId(effectiveUserId);
          
          // Check if this doctor is also a provider account
          const { data, error } = await supabase
            .from('providers')
            .select('id')
            .eq('user_id', effectiveUserId)
            .maybeSingle();
          
          setIsProviderAccount(!error && data !== null);
        } 
        // If role is provider, fetch the practice_id from providers table
        else if (effectiveRole === 'provider') {
          const { data, error } = await supabase
            .from('providers')
            .select('practice_id')
            .eq('user_id', effectiveUserId)
            .limit(1)
            .single();

          if (!error && data) {
            setEffectivePracticeId(data.practice_id);
            setIsProviderAccount(true);
            console.debug('Auth: effectivePracticeId set for provider', data.practice_id);
          } else {
            setEffectivePracticeId(null);
            setIsProviderAccount(false);
            if (error) logger.info('Auth: provider practice lookup', logger.sanitize({ error: error.message }));
          }
        } else {
          // Admin or other roles
          setEffectivePracticeId(null);
          setIsProviderAccount(false);
        }
      } catch (error) {
        logger.error('Error checking provider status and practice', error);
        setIsProviderAccount(false);
        setEffectivePracticeId(null);
      }
    };

    void checkProviderStatusAndPractice();
  }, [effectiveUserId, effectiveRole]);

  // Real-time monitoring for account status changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.active === false && payload.old.active === true) {
            toast.error("🚫 Your account has been disabled by an administrator. You will be signed out.");
            setTimeout(() => {
              void (async () => {
                // End impersonation log if active
                const storedImpersonation = sessionStorage.getItem('vitaluxe_impersonation');
                if (storedImpersonation) {
                  try {
                    const { logId } = JSON.parse(storedImpersonation);
                    if (logId) {
                      await supabase
                        .from('impersonation_logs')
                        .update({ end_time: new Date().toISOString() })
                        .eq('id', logId);
                    }
                  } catch (e) {
                    logger.error('Error ending impersonation log on deactivation', e);
                  }
                }
                
                await supabase.auth.signOut();
                setUserRole(null);
                setImpersonatedRole(null);
                setImpersonatedUserId(null);
                setImpersonatedUserName(null);
                setCurrentLogId(null);
                setIs2FAVerifiedThisSession(false);
                sessionStorage.removeItem('vitaluxe_impersonation');
                navigate("/auth");
              })();
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchUserRole = async (userId: string) => {
    console.log('[AuthContext] fetchUserRole - START for userId:', userId);
    try {
      logger.info('Fetching user role (optimized)', logger.sanitize({ userId }));
      
      // Check sessionStorage cache first (expires after 5 minutes)
      const cached = sessionStorage.getItem('vitaluxe_auth_cache');
      if (cached) {
        try {
          const { role, timestamp, practiceId, canImpersonate: cachedCanImpersonate } = JSON.parse(cached);
          const age = Date.now() - timestamp;
          if (age < 300000 && role) { // 5 minute cache
            logger.info('Using cached auth data', { role, age: Math.floor(age / 1000) + 's' });
            setUserRole(role);
            if (practiceId) setPracticeParentId(practiceId);
            if (typeof cachedCanImpersonate === 'boolean') setCanImpersonateDb(cachedCanImpersonate);
            
            // Check password and 2FA status immediately (non-blocking but synchronous)
            void checkPasswordStatus(role, userId); // Pass role and userId we just loaded from cache
            void check2FAStatus(userId);
            
            // Restore impersonation if admin
            if (role === 'admin') {
              const stored = sessionStorage.getItem('vitaluxe_impersonation');
              if (stored) {
                try {
                  const { role: impRole, userId: impUserId, userName, logId } = JSON.parse(stored);
                  setImpersonatedRole(impRole);
                  setImpersonatedUserId(impUserId || null);
                  setImpersonatedUserName(userName || null);
                  setCurrentLogId(logId || null);
                } catch (e) {
                  sessionStorage.removeItem('vitaluxe_impersonation');
                }
              }
            }
            return;
          }
        } catch (e) {
          sessionStorage.removeItem('vitaluxe_auth_cache');
        }
      }

      // Parallelize all auth checks for maximum speed
      const [
        roleResult,
        providerResult,
        impersonationResult,
        passwordResult
      ] = await Promise.allSettled([
        // 1. Fetch role
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle(),
        
        // 2. Fetch provider data (will be filtered after we know role)
        supabase
          .from('providers')
          .select('practice_id')
          .eq('user_id', userId)
          .maybeSingle(),
        
        // 3. Check impersonation permission
        supabase.rpc('can_user_impersonate', { _user_id: userId }),
        
        // 4. Check password status
        supabase
          .from('user_password_status')
          .select('must_change_password, terms_accepted')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      // Process role
      const role = roleResult.status === 'fulfilled' && roleResult.value.data?.role 
        ? roleResult.value.data.role 
        : null;
      
      if (!role) throw new Error('No role found');
      
      logger.info('User role fetched (parallel)', { role });
      setUserRole(role);

      // Process provider data (only if provider role)
      if (role === 'provider' && providerResult.status === 'fulfilled') {
        const practiceId = providerResult.value.data?.practice_id;
        if (practiceId) {
          setPracticeParentId(practiceId);
        }
      }

      // Process impersonation permission
      const canImpersonate = impersonationResult.status === 'fulfilled' && impersonationResult.value.data === true;
      setCanImpersonateDb(canImpersonate);

      // Restore impersonation from sessionStorage if authorized admin
      if (role === 'admin' && canImpersonate) {
        const stored = sessionStorage.getItem('vitaluxe_impersonation');
        if (stored) {
          try {
            const { role: impRole, userId: impUserId, userName, logId } = JSON.parse(stored);
            setImpersonatedRole(impRole);
            setImpersonatedUserId(impUserId || null);
            setImpersonatedUserName(userName || null);
            setCurrentLogId(logId || null);
          } catch (e) {
            sessionStorage.removeItem('vitaluxe_impersonation');
          }
        }
      }

      // Process password status
      if (role === 'admin') {
        // Admins ALWAYS exempt, regardless of database value
        setMustChangePassword(false);
        setTermsAccepted(true);
      } else if (passwordResult.status === 'fulfilled' && passwordResult.value.data) {
        setMustChangePassword(passwordResult.value.data.must_change_password || false);
        setTermsAccepted(passwordResult.value.data.terms_accepted || false);
      } else {
        // FALLBACK: If password check failed, use safe defaults
        logger.warn('Password status check failed, using safe defaults');
        setMustChangePassword(false);
        setTermsAccepted(false);
      }
      // ALWAYS set this to true, even if checks fail
      setPasswordStatusChecked(true);

      // Process 2FA status using dedicated check function
      await check2FAStatus(userId);

      // Cache auth data in sessionStorage
      sessionStorage.setItem('vitaluxe_auth_cache', JSON.stringify({
        role,
        practiceId: role === 'provider' && providerResult.status === 'fulfilled' ? providerResult.value.data?.practice_id : null,
        canImpersonate,
        timestamp: Date.now()
      }));
      
      console.log('[AuthContext] fetchUserRole - END, role set to:', role);
      logger.info('All user data loaded (parallel + cached)');
    } catch (error) {
      console.log('[AuthContext] fetchUserRole - ERROR, role set to null');
      logger.error("Error fetching user role", error);
      setUserRole(null);
      sessionStorage.removeItem('vitaluxe_auth_cache');
    }
  };

  const checkPasswordStatus = async (roleOverride?: string, userIdOverride?: string): Promise<{ mustChangePassword: boolean; termsAccepted: boolean }> => {
    // Determine role and user ID safely (avoid early returns that keep spinner)
    const roleToCheck = roleOverride || effectiveRole;
    const uid = userIdOverride || effectiveUserId || user?.id || null;

    logger.info('checkPasswordStatus start', { roleToCheck, hasUid: !!uid, isImpersonating });

    // Admins (not impersonating) are always exempt
    if (roleToCheck === 'admin' && !isImpersonating) {
      setMustChangePassword(false);
      setTermsAccepted(true);
      setPasswordStatusChecked(true);
      logger.info('checkPasswordStatus admin bypass');
      return { mustChangePassword: false, termsAccepted: true };
    }

    // If uid is not yet available due to initialization race, avoid blocking UI
    if (!uid) {
      setMustChangePassword(false);
      setTermsAccepted(true);
      setPasswordStatusChecked(true);
      logger.warn('checkPasswordStatus no uid yet - using safe defaults');
      return { mustChangePassword: false, termsAccepted: true };
    }

    // Check session storage for "just accepted" flag
    const sessionKey = `vitaluxe_terms_ok_${uid}`;
    const sessionFlag = sessionStorage.getItem(sessionKey);
    if (sessionFlag) {
      logger.info('checkPasswordStatus session flag found, treating terms as accepted for this session');
      setTermsAccepted(true);
      setMustChangePassword(false);
      setPasswordStatusChecked(true);
      // Continue to background recheck below
    }

    try {
      // If impersonating and not checking the admin's own status, use admin function
      if (isImpersonating && uid !== user?.id && roleToCheck !== 'admin') {
        logger.info('checkPasswordStatus impersonating -> using admin-get-password-status');
        
        const { data, error } = await supabase.functions.invoke('admin-get-password-status', {
          body: { target_user_id: uid }
        });

        if (error) {
          logger.error('admin-get-password-status error:', error);
          // Safe fallback for admins: don't block them
          logger.info('Falling back: setting termsAccepted=true for admin impersonation');
          setTermsAccepted(true);
          setMustChangePassword(false);
          setPasswordStatusChecked(true);
          return { mustChangePassword: false, termsAccepted: true };
        }

        logger.info('admin-get-password-status result:', data);
        const mustChange = data.must_change_password || false;
        const termsAccept = data.terms_accepted || false;
        
        setMustChangePassword(mustChange);
        setTermsAccepted(termsAccept);
        setPasswordStatusChecked(true);
        
        return { mustChangePassword: mustChange, termsAccepted: termsAccept };
      }

      // Not impersonating: direct read
      logger.info('checkPasswordStatus direct read of user_password_status');
      const { data, error } = await supabase
        .from('user_password_status')
        .select('must_change_password, terms_accepted')
        .eq('user_id', uid)
        .maybeSingle();

      if (error) {
        logger.error('Error checking password status', error);
        setPasswordStatusChecked(true);
        return { mustChangePassword: false, termsAccepted: false };
      }

      const mustChange = data?.must_change_password || false;
      const termsAccept = data?.terms_accepted || false;

      setMustChangePassword(mustChange);
      setTermsAccepted(termsAccept);
      setPasswordStatusChecked(true);

      logger.info('checkPasswordStatus done', { mustChange, termsAccept });
      return { mustChangePassword: mustChange, termsAccepted: termsAccept };
    } catch (error) {
      logger.error('Error in checkPasswordStatus', error);
      setPasswordStatusChecked(true);
      return { mustChangePassword: false, termsAccepted: false };
    }
  };

  // Re-check password status when impersonation changes - optimized to only check real user ID changes
  useEffect(() => {
    if (user && effectiveUserId && effectiveRole && !initializing && effectiveUserId !== user.id) {
      logger.info('Re-checking password status for impersonated user');
      void checkPasswordStatus(effectiveRole || undefined, effectiveUserId || undefined);
    }
  }, [effectiveUserId]);

  // Hard 60-minute session timeout function
  const doHardSignOut = async () => {
    logger.info('Hard session timeout - forcing logout after 60 minutes');
    
    // Clear the timer
    if (hardTimerRef.current) {
      clearTimeout(hardTimerRef.current);
      hardTimerRef.current = null;
    }
    
    // Remove expiration timestamp
    localStorage.removeItem(SESSION_EXP_KEY);
    
    // Clear any 2FA verification cache
    if (user?.id) {
      sessionStorage.removeItem(`vitaluxe_2fa_verified_${user.id}`);
      sessionStorage.removeItem(`vitaluxe_2fa_attempt_${user.id}`);
    }
    
    // Close impersonation if active
    if (isImpersonating && currentLogId) {
      try {
        await supabase
          .from('impersonation_logs')
          .update({ end_time: new Date().toISOString() })
          .eq('id', currentLogId);
      } catch (error) {
        logger.error('Error ending impersonation on hard timeout', error);
      }
    }
    
    // Sign out
    await supabase.auth.signOut();
    
    // Navigate to auth page
    navigate('/auth');
    
    // Show toast
    toast.info('Session expired after 60 minutes. Please log in again.');
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setTwoFAStatusChecked(false);
      setIs2FAVerifiedThisSession(false); // Reset 2FA verification on new login
      
      // Delegate to authService
      const { error } = await authService.loginUser(email, password);
      
      if (error) {
        setLoading(false);
        return { error };
      }

      // Fetch user data including 2FA status
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await fetchUserRole(session.user.id);
      }

      const csrfToken = await generateCSRFToken();
      if (!csrfToken) {
        logger.warn('Failed to generate CSRF token');
      }

      setLoading(false);
      
      return { error: null };
    } catch (error: any) {
      setLoading(false);
      setTwoFAStatusChecked(false);
      return { error };
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    name: string, 
    role: string, 
    roleData: any,
    fullName?: string,
    prescriberName?: string
  ) => {
    // Delegate to authService for self-signup flow
    return authService.signupUser({
      email,
      password,
      name,
      role,
      roleData,
      fullName,
      prescriberName,
    });
  };

  const setImpersonation = async (role: string | null, userId?: string | null, userName?: string | null, targetEmail?: string | null) => {
    // Only allow the specific admin to impersonate
    if (!canImpersonate) {
      toast.error("You are not authorized to use impersonation");
      return;
    }
    
    // If ending impersonation, update the log
    if (!role && currentLogId) {
      try {
        await supabase
          .from('impersonation_logs')
          .update({ end_time: new Date().toISOString() })
          .eq('id', currentLogId);
        setCurrentLogId(null);
      } catch (error) {
        logger.error('Error updating impersonation log', error);
      }
    }
    
    // If starting impersonation, create a log
    if (role && userId) {
      try {
        const { data: logData, error: logError } = await supabase
          .from('impersonation_logs')
          .insert({
            impersonator_email: user?.email || '',
            impersonator_id: user?.id || '',
            target_user_id: userId,
            target_user_email: targetEmail || '',
            target_user_name: userName || '',
            target_role: role,
            session_id: session?.access_token?.substring(0, 20) || '',
          })
          .select('id')
          .single();

        if (logError) {
          logger.error('Error creating impersonation log', logError);
          toast.error("Failed to log impersonation session");
          return;
        }

        if (logData) {
          setCurrentLogId(logData.id);
          sessionStorage.setItem('vitaluxe_impersonation', JSON.stringify({ 
            role, 
            userId: userId || null, 
            userName: userName || null,
            logId: logData.id,
            timestamp: Date.now() 
          }));
        }
      } catch (error) {
        logger.error('Error logging impersonation', error);
        toast.error("Failed to start impersonation session");
        return;
      }
    } else {
      sessionStorage.removeItem('vitaluxe_impersonation');
    }
    
    setImpersonatedRole(role);
    setImpersonatedUserId(userId || null);
    setImpersonatedUserName(userName || null);
    
    if (role) {
      toast.success(`Now viewing as ${userName || role}`);
    } else {
      toast.success("Returned to your Admin account");
    }
  };

  const clearImpersonation = async () => {
    // Update the log before clearing
    if (currentLogId) {
      try {
        await supabase
          .from('impersonation_logs')
          .update({ end_time: new Date().toISOString() })
          .eq('id', currentLogId);
      } catch (error) {
        logger.error('Error updating impersonation log', error);
      }
    }
    
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    sessionStorage.removeItem('vitaluxe_impersonation');
    toast.success("Returned to your Admin account");
  };

  const signOut = async (reason: string = 'manual_logout') => {
    logger.info('[AuthContext] Sign out initiated', {
      reason,
      userId: user?.id,
      isImpersonating
    });
    
    setLoading(true);
    
    // Clear hard timer
    if (hardTimerRef.current) {
      clearTimeout(hardTimerRef.current);
      hardTimerRef.current = null;
    }
    localStorage.removeItem(SESSION_EXP_KEY);
    
    // End impersonation log if active
    if (currentLogId) {
      try {
        await supabase
          .from('impersonation_logs')
          .update({ end_time: new Date().toISOString() })
          .eq('id', currentLogId);
      } catch (error) {
        logger.error('Error updating impersonation log on signout', error);
      }
    }
    
    // Clear CSRF token before signing out
    clearCSRFToken();
    
    // Clear auth cache
    sessionStorage.removeItem('vitaluxe_auth_cache');
    
    // Clear 2FA verification cache on logout
    if (user?.id) {
      sessionStorage.removeItem(`vitaluxe_2fa_verified_${user.id}`);
      sessionStorage.removeItem(`vitaluxe_2fa_attempt_${user.id}`);
    }
    
    await supabase.auth.signOut();
    setUserRole(null);
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    setTwoFAStatusChecked(false);
    setIs2FAVerifiedThisSession(false);
    sessionStorage.removeItem('vitaluxe_impersonation');
    setLoading(false);
    navigate("/auth");
  };

  // Mark 2FA as verified for current session
  const mark2FAVerified = () => {
    console.log('[AuthContext] ✅ mark2FAVerified called');
    setIs2FAVerifiedThisSession(true);
    setRequires2FAVerify(false);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      loading,
      initializing,
      actualRole,
      impersonatedRole,
      impersonatedUserId,
      impersonatedUserName,
      isImpersonating,
      effectiveRole,
      effectiveUserId,
      effectivePracticeId,
      canImpersonate,
      isProviderAccount,
      mustChangePassword,
      termsAccepted,
      passwordStatusChecked,
      requires2FASetup,
      requires2FAVerify,
      user2FAPhone,
      twoFAStatusChecked,
      mark2FAVerified,
      checkPasswordStatus,
      setImpersonation,
      clearImpersonation,
      signIn, 
      signUp, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
