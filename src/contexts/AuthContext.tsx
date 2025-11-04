import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { realtimeManager } from "@/lib/realtimeManager";
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
  originalUserId: string | null;
  canImpersonate: boolean;
  isProviderAccount: boolean;
  isStaffAccount: boolean;
  mustChangePassword: boolean;
  termsAccepted: boolean;
  requires2FASetup: boolean;
  requires2FAVerify: boolean;
  user2FAPhone: string | null;
  twoFAStatusChecked: boolean;
  passwordStatusChecked: boolean;
  showIntakeDialog: boolean;
  setShowIntakeDialog: (show: boolean) => void;
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
  const [isStaffAccount, setIsStaffAccount] = useState(false);
  const [effectivePracticeId, setEffectivePracticeId] = useState<string | null>(null);
  const [originalUserId, setOriginalUserId] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [passwordStatusChecked, setPasswordStatusChecked] = useState(false);
  const [canImpersonateDb, setCanImpersonateDb] = useState(false);
  const [requires2FASetup, setRequires2FASetup] = useState(false);
  const [requires2FAVerify, setRequires2FAVerify] = useState(false);
  const [user2FAPhone, setUser2FAPhone] = useState<string | null>(null);
  const [twoFAStatusChecked, setTwoFAStatusChecked] = useState(false);
  const [is2FAVerifiedThisSession, setIs2FAVerifiedThisSession] = useState(false);
  const [twoFAEnforcementEnabled, setTwoFAEnforcementEnabled] = useState<boolean>(true);
  const [showIntakeDialog, setShowIntakeDialog] = useState(false);
  
  // Hard 30-minute session timeout with activity refresh
  const HARD_SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  const REFRESH_THRESHOLD_MS = 2 * 60 * 1000; // Refresh if < 2 minutes remaining (aggressive timeout detection)
  const MAX_SESSION_MS = 120 * 60 * 1000; // 2 hours maximum
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity triggers logout
  const getSessionExpKey = (userId: string) => `vitaluxe_session_exp_${userId}`;
  const getSessionStartKey = (userId: string) => `vitaluxe_session_start_${userId}`;
  const hardTimerRef = useRef<number | null>(null);
  const checkIntervalRef = useRef<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastExtensionCheck = useRef<number>(0); // Throttle extension checks
  const activityListenersAttached = useRef(false);
  
  const navigate = useNavigate();
  
  // Prevent double initial load
  const hasBootstrapped = useRef(false);

  const actualRole = userRole;
  const isImpersonating = impersonatedRole !== null;
  const effectiveRole = impersonatedRole || userRole;
  const effectiveUserId = impersonatedUserId || user?.id || null;
  const canImpersonate = userRole === 'admin' && canImpersonateDb;

  // Function to fetch 2FA enforcement setting
  const fetchTwoFAEnforcementSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'two_fa_enforcement_enabled')
        .single();
      
      if (error) throw error;
      
      // Parse the setting value (stored as string 'true'/'false')
      const isEnabled = data.setting_value === 'true';
      setTwoFAEnforcementEnabled(isEnabled);
      return isEnabled;
    } catch (error) {
      logger.error('Error fetching 2FA enforcement setting', error);
      // Default to enabled for security
      setTwoFAEnforcementEnabled(true);
      return true;
    }
  };

  // Function to check GHL 2FA status
  const check2FAStatus = async (userId: string) => {
    console.log('[AuthContext] check2FAStatus - START for userId:', userId);
    
    // Check if 2FA enforcement is enabled system-wide
    const isEnforced = await fetchTwoFAEnforcementSetting();
    
    if (!isEnforced) {
      console.log('[AuthContext] check2FAStatus - 2FA enforcement DISABLED system-wide');
      setRequires2FASetup(false);
      setRequires2FAVerify(false);
      setTwoFAStatusChecked(true);
      return;
    }
    
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
        // Enrolled - require verification unless already verified for this hard session
        const twoFaKey = `vitaluxe_2fa_verified_until_${userId}`;
        const verifiedUntil = localStorage.getItem(twoFaKey);
        const sessionExpireAt = localStorage.getItem(getSessionExpKey(userId));
        const now = Date.now();
        const isVerified = verifiedUntil && sessionExpireAt
          ? parseInt(verifiedUntil) > now && parseInt(sessionExpireAt) > now
          : false;

        setRequires2FASetup(false);
        setUser2FAPhone(data.phone_number);
        if (isVerified) {
          setIs2FAVerifiedThisSession(true);
          setRequires2FAVerify(false);
          console.log('[AuthContext] check2FAStatus - Already verified for this session');
        } else {
          setRequires2FAVerify(true);
          console.log('[AuthContext] check2FAStatus - Requires verification');
        }
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
      
      // If retry fails, try using cached data as fallback
      logger.warn('Auth bootstrap timeout - attempting cache fallback');
      try {
        const cached = sessionStorage.getItem('vitaluxe_auth_cache');
        if (cached) {
          const { role, practiceId, canImpersonate, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < 2 * 60 * 1000) { // 2min cache validity - aggressive for speed
            logger.info('Using cached auth data from failsafe');
            setUserRole(role);
            if (practiceId) setPracticeParentId(practiceId);
            if (typeof canImpersonate === 'boolean') setCanImpersonateDb(canImpersonate);
            setPasswordStatusChecked(true);
            setTwoFAStatusChecked(true);
            setInitializing(false);
            return;
          }
        }
      } catch (e) {
        logger.error('Cache fallback failed', e);
      }
      
      // Final fallback - clear state
      logger.error('Auth bootstrap failed after retry and cache fallback');
      setInitializing(false);
      setUserRole(null);
    }, 2000); // Reduced from 8000ms to 2000ms

    // Activity tracking for session extension
    const handleActivity = () => {
      if (!user?.id) return;
      
      const now = Date.now();
      lastActivityRef.current = now;
      
      // Throttle extension checks to once every 3 seconds (prevent excessive localStorage writes)
      if (now - lastExtensionCheck.current < 3000) return;
      lastExtensionCheck.current = now;
      
      // Check if we should extend the session
      const sessionExpStr = localStorage.getItem(getSessionExpKey(user.id));
      const sessionStartStr = localStorage.getItem(getSessionStartKey(user.id));
      
      if (!sessionExpStr || !sessionStartStr) return;
      
      const sessionExp = parseInt(sessionExpStr);
      const sessionStart = parseInt(sessionStartStr);
      const timeRemaining = sessionExp - now;
      const totalSessionTime = now - sessionStart;
      
      // Debug logging
      console.log('[Session] Activity detected, checking extension...', {
        timeRemainingMinutes: Math.round(timeRemaining / 60000),
        totalSessionMinutes: Math.round(totalSessionTime / 60000),
        thresholdMinutes: Math.round(REFRESH_THRESHOLD_MS / 60000),
        maxSessionMinutes: Math.round(MAX_SESSION_MS / 60000),
        willExtend: timeRemaining < REFRESH_THRESHOLD_MS && totalSessionTime < MAX_SESSION_MS
      });
      
      // Only extend if:
      // 1. Less than 15 minutes remaining
      // 2. Haven't exceeded 2 hour max session
      if (timeRemaining < REFRESH_THRESHOLD_MS && totalSessionTime < MAX_SESSION_MS) {
        const newExpireAt = now + HARD_SESSION_TIMEOUT_MS;
        const cappedExpireAt = Math.min(newExpireAt, sessionStart + MAX_SESSION_MS);
        
        localStorage.setItem(getSessionExpKey(user.id), String(cappedExpireAt));
        
        // Clear and reset timeout
        if (hardTimerRef.current) {
          clearTimeout(hardTimerRef.current);
        }
        
        const timeUntilExpiry = cappedExpireAt - now;
        hardTimerRef.current = window.setTimeout(() => {
          logger.info('Extended session timer triggered logout');
          void doHardSignOut();
        }, timeUntilExpiry);
        
        const minutesAdded = Math.round((cappedExpireAt - sessionExp) / 60000);
        console.log('[Session] ✅ Session extended due to activity!', {
          newExpiresAt: new Date(cappedExpireAt).toISOString(),
          minutesAdded,
          newTimeRemaining: Math.round((cappedExpireAt - now) / 60000) + 'm'
        });
        
        logger.info('Session extended due to activity', {
          newExpiresAt: new Date(cappedExpireAt).toISOString(),
          minutesAdded
        });
      } else {
        // Log why extension didn't happen
        if (timeRemaining >= REFRESH_THRESHOLD_MS) {
          console.log('[Session] ⏳ No extension - still above threshold', {
            timeRemaining: Math.round(timeRemaining / 60000) + 'm',
            threshold: Math.round(REFRESH_THRESHOLD_MS / 60000) + 'm'
          });
        } else if (totalSessionTime >= MAX_SESSION_MS) {
          console.log('[Session] 🛑 No extension - at maximum session time (2 hours)');
        }
      }
    };

    // Attach activity listeners once (excluding oversensitive events)
    if (user?.id && !activityListenersAttached.current) {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      events.forEach(event => {
        document.addEventListener(event, handleActivity, { passive: true });
      });
      activityListenersAttached.current = true;
      
      console.log('[Session] 🎧 Activity listeners attached:', events);
      logger.info('Activity listeners attached for intentional user actions only');
    }

    // Event handlers for tab visibility and focus
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        maybeSignOutIfExpired();
      }
    };

    const handleFocus = () => {
      maybeSignOutIfExpired();
    };

    const handleStorage = (e: StorageEvent) => {
      // Check if session expiration was changed in another tab (any user)
      if (e.key?.startsWith('vitaluxe_session_exp_')) {
        maybeSignOutIfExpired();
      }
    };

    // Add event listeners for tab wake/focus
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorage);

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
          
          // Clear any existing timers/intervals first
          if (hardTimerRef.current) {
            clearTimeout(hardTimerRef.current);
            hardTimerRef.current = null;
          }
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          
          // Set hard session expiration (30 minutes from now)
          const expireAt = Date.now() + HARD_SESSION_TIMEOUT_MS;
          const sessionStart = Date.now();
          localStorage.setItem(getSessionExpKey(session.user.id), String(expireAt));
          localStorage.setItem(getSessionStartKey(session.user.id), String(sessionStart));
          lastActivityRef.current = Date.now();
          
          // Schedule primary hard timeout
          hardTimerRef.current = window.setTimeout(() => {
            logger.info('Primary timer triggered logout');
            void doHardSignOut();
          }, HARD_SESSION_TIMEOUT_MS);
          
          // Schedule failsafe interval check (every 10 seconds) with hard inactivity check
          checkIntervalRef.current = window.setInterval(() => {
            // Check for 30 minutes of inactivity (hard rule)
            const timeSinceActivity = Date.now() - lastActivityRef.current;
            if (timeSinceActivity >= INACTIVITY_TIMEOUT_MS) {
              console.log('[Session] 🛑 30-minute inactivity detected - forcing logout', {
                minutesInactive: Math.round(timeSinceActivity / 60000)
              });
              logger.info('30-minute inactivity timeout - forcing logout');
              void doHardSignOut();
              return;
            }
            
            // Also check normal expiration
            maybeSignOutIfExpired();
          }, 10000); // Check every 10 seconds for faster response
          
          logger.info('Session timer started', { 
            expiresAt: new Date(expireAt).toISOString(),
            minutesRemaining: 30
          });
          
            // DEFER ALL SUPABASE CALLS TO PREVENT DEADLOCK
            setTimeout(() => {
              console.log('[AuthContext] Executing deferred backend calls');
              
              // Fetch role and CSRF token asynchronously (don't block)
              Promise.all([
                fetchUserRole(session.user.id),
                generateCSRFToken()
              ]).then(async ([roleResult]) => {
                logger.info('SIGNED_IN: user data loaded');
                
                // Check if user needs to complete intake (patient-only feature)
                const { data: patientData } = await supabase
                  .from('patient_accounts')
                  .select('intake_completed_at')
                  .eq('user_id', session.user.id)
                  .maybeSingle();
                
                // If patient account exists and intake is incomplete, show dialog
                if (patientData && !patientData.intake_completed_at) {
                  console.log('[AuthContext] Patient needs to complete intake, showing dialog');
                  setShowIntakeDialog(true);
                } else {
                  console.log('[AuthContext] No intake required', { 
                    hasPatientAccount: !!patientData, 
                    intakeComplete: patientData?.intake_completed_at 
                  });
                }
                
                // Auto-enroll practice owners (doctors) in 14-day trial
                // Wait a bit for userRole state to be set by fetchUserRole
                setTimeout(async () => {
                  // Query for user's role from user_roles table
                  const { data: userRoles } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', session.user.id)
                    .maybeSingle();

                  if (userRoles?.role === 'doctor') {
                    // Check if subscription exists
                    const { data: existingSub } = await supabase
                      .from('practice_subscriptions')
                      .select('id')
                      .eq('practice_id', session.user.id)
                      .maybeSingle();
                    
                    if (!existingSub) {
                      // Auto-create trial subscription
                      console.log('[AuthContext] Auto-enrolling new practice in 14-day trial');
                      
                      try {
                        const { error: subError } = await supabase.functions.invoke(
                          'subscribe-to-vitaluxepro',
                          { body: { autoEnroll: true } }
                        );
                        
                        if (subError) {
                          console.error('[AuthContext] Auto-enrollment failed:', subError);
                        } else {
                          // Show welcome notification
                          toast.success(
                            "Welcome to VitaLuxePro! 🎉",
                            {
                              description: "You've been automatically enrolled in a 14-day free trial with full access to all features. Add a payment method before day 14 to continue.",
                              duration: 10000,
                            }
                          );
                        }
                      } catch (error) {
                        console.error('[AuthContext] Auto-enrollment error:', error);
                      }
                    }
                  }
                }, 500);
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
          console.log('[AuthContext] ⚠️ SIGNED_OUT event received');
          
          // CRITICAL: Capture user ID before clearing
          const userIdToClean = user?.id;
          
          // Clear timers
          if (hardTimerRef.current) {
            clearTimeout(hardTimerRef.current);
            hardTimerRef.current = null;
          }
          if (checkIntervalRef.current) {
            clearInterval(checkIntervalRef.current);
            checkIntervalRef.current = null;
          }
          
          // Clear session storage using captured ID
          if (userIdToClean) {
            localStorage.removeItem(getSessionExpKey(userIdToClean));
            localStorage.removeItem(getSessionStartKey(userIdToClean));
          }
          
          // Clear 2FA verification using captured ID
          if (userIdToClean) {
            localStorage.removeItem(`vitaluxe_2fa_verified_until_${userIdToClean}`);
            sessionStorage.removeItem(`vitaluxe_2fa_verified_${userIdToClean}`);
            sessionStorage.removeItem(`vitaluxe_2fa_attempt_${userIdToClean}`);
          }
          
          // Clear auth cache
          sessionStorage.removeItem('vitaluxe_auth_cache');
          // Server-side session will be cleaned up by timeout or explicit end call
          
          // Clear all state
          setUserRole(null);
          setImpersonatedRole(null);
          setImpersonatedUserId(null);
          setImpersonatedUserName(null);
          setCurrentLogId(null);
          setTwoFAStatusChecked(false);
          setPasswordStatusChecked(false);
          setIs2FAVerifiedThisSession(false);
          setRequires2FASetup(false);
          setRequires2FAVerify(false);
          setShowIntakeDialog(false);
          
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
        // Rehydrate 2FA verification status from localStorage (persisted for duration of hard session)
        const verifiedKey = `vitaluxe_2fa_verified_until_${session.user.id}`;
        const verifiedUntil = localStorage.getItem(verifiedKey);
        const sessionExpireAt = localStorage.getItem(getSessionExpKey(session.user.id));
        if (verifiedUntil && sessionExpireAt) {
          const now = Date.now();
          const valid = parseInt(verifiedUntil) > now && parseInt(sessionExpireAt) > now;
          if (valid) {
            setIs2FAVerifiedThisSession(true);
            setRequires2FAVerify(false);
            logger.info('[AuthContext] Restored 2FA verification from localStorage');
          }
        }
        
        // Check if hard session has expired
        const expireAt = localStorage.getItem(getSessionExpKey(session.user.id));
        
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
            
            // Also set up failsafe interval
            checkIntervalRef.current = window.setInterval(() => {
              maybeSignOutIfExpired();
            }, 30000);
          }
        } else {
          // No expiration found (shouldn't happen) - set fresh 30 minute timer
          logger.warn('No session expiration found - creating fresh timer');
          const expireAt = Date.now() + HARD_SESSION_TIMEOUT_MS;
          localStorage.setItem(getSessionExpKey(session.user.id), String(expireAt));
          hardTimerRef.current = window.setTimeout(() => {
            void doHardSignOut();
          }, HARD_SESSION_TIMEOUT_MS);
          
          // Set up failsafe interval
          checkIntervalRef.current = window.setInterval(() => {
            maybeSignOutIfExpired();
          }, 30000);
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
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      // Remove event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // Activity-based session refresh
  useEffect(() => {
    if (!session || !user) return;

    const refreshSession = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          logger.error('Failed to refresh session:', error);
          return;
        }
        
        // Extend session expiration
        const expireAt = Date.now() + HARD_SESSION_TIMEOUT_MS;
        localStorage.setItem(getSessionExpKey(user.id), String(expireAt));
        
        // Reset timer
        if (hardTimerRef.current) {
          clearTimeout(hardTimerRef.current);
        }
        hardTimerRef.current = window.setTimeout(() => {
          void doHardSignOut();
        }, HARD_SESSION_TIMEOUT_MS);
        
        logger.info('Session refreshed due to activity', {
          expiresAt: new Date(expireAt).toISOString()
        });
      } catch (error) {
        logger.error('Error refreshing session:', error);
      }
    };

    const handleActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // Only refresh once every 5 minutes and if session is close to expiring
      if (timeSinceLastActivity > REFRESH_THRESHOLD_MS) {
        const expireAt = localStorage.getItem(getSessionExpKey(user.id));
        if (expireAt) {
          const timeRemaining = parseInt(expireAt) - now;
          // Refresh if less than 5 minutes remaining
          if (timeRemaining < REFRESH_THRESHOLD_MS && timeRemaining > 0) {
            lastActivityRef.current = now;
            void refreshSession();
          }
        }
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [session, user]);

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
          
          if (!error && data !== null) {
            setIsProviderAccount(true);
            setIsStaffAccount(false);
          } else {
            // Check if this is a staff account
            const { data: staffData, error: staffError } = await supabase
              .from('practice_staff')
              .select('practice_id')
              .eq('user_id', effectiveUserId)
              .maybeSingle();

            if (!staffError && staffData?.practice_id) {
              setEffectivePracticeId(staffData.practice_id);
              setIsStaffAccount(true);
              setIsProviderAccount(false);
              logger.info('Auth: doctor is staff member', logger.sanitize({ practiceId: staffData.practice_id }));
            } else {
              setIsProviderAccount(false);
              setIsStaffAccount(false);
            }
          }
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
        } 
        // If role is staff, fetch the practice_id from practice_staff table
        else if (effectiveRole === 'staff') {
          const { data, error } = await supabase
            .from('practice_staff')
            .select('practice_id')
            .eq('user_id', effectiveUserId)
            .maybeSingle();

          if (!error && data?.practice_id) {
            setEffectivePracticeId(data.practice_id);
            setIsStaffAccount(true);
            setIsProviderAccount(false);
            console.debug('Auth: effectivePracticeId set for staff member', data.practice_id);
          } else {
            setEffectivePracticeId(null);
            setIsStaffAccount(false);
            setIsProviderAccount(false);
            if (error) logger.info('Auth: staff practice lookup', logger.sanitize({ error: error.message }));
          }
        } else if (effectiveRole === 'patient') {
          // For patients, fetch practice_id from patient_accounts
          const { data, error } = await supabase
            .from('patient_accounts')
            .select('practice_id')
            .eq('user_id', effectiveUserId)
            .maybeSingle();

          if (!error && data?.practice_id) {
            setEffectivePracticeId(data.practice_id);
            setIsProviderAccount(false);
            setIsStaffAccount(false);
            console.debug('Auth: effectivePracticeId set for patient', data.practice_id);
          } else {
            setEffectivePracticeId(null);
            setIsProviderAccount(false);
            setIsStaffAccount(false);
            if (error) logger.info('Auth: patient practice lookup', logger.sanitize({ error: error.message }));
          }
        } else {
          // Admin or other roles
          setEffectivePracticeId(null);
          setIsProviderAccount(false);
          setIsStaffAccount(false);
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

    realtimeManager.subscribe('profiles', (payload) => {
      if (payload.eventType === 'UPDATE' && (payload.new as any).id === user.id) {
        if ((payload.new as any).active === false && (payload.old as any).active === true) {
          toast.error("🚫 Your account has been disabled by an administrator. You will be signed out.");
          setTimeout(() => {
            void (async () => {
              // End impersonation session if active
              try {
                const { data: { session: authSession } } = await supabase.auth.getSession();
                const token = authSession?.access_token;
                if (token) {
                  const { data: sessionData } = await supabase.functions.invoke('get-active-impersonation', {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (sessionData?.session) {
                    await supabase.functions.invoke('end-impersonation', {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                  }
                }
              } catch (e) {
                logger.error('Error ending impersonation on deactivation', e);
              }
              
              await supabase.auth.signOut();
              setUserRole(null);
              setImpersonatedRole(null);
              setImpersonatedUserId(null);
              setImpersonatedUserName(null);
              setCurrentLogId(null);
              setIs2FAVerifiedThisSession(false);
              // Server-side session cleanup handled above
              navigate("/auth");
            })();
          }, 3000);
        }
      }
    });

    return () => {
      // Manager handles cleanup
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
            
            // Restore impersonation if admin - fetch from server
            if (role === 'admin') {
              try {
                const { data: { session: authSession } } = await supabase.auth.getSession();
                const token = authSession?.access_token;
                let sessionData: any;
                if (token) {
                  ({ data: sessionData } = await supabase.functions.invoke('get-active-impersonation', {
                    headers: { Authorization: `Bearer ${token}` }
                  }));
                } else {
                  ({ data: sessionData } = await supabase.functions.invoke('get-active-impersonation'));
                }
                if (sessionData?.session) {
                  const session = sessionData.session;
                  setImpersonatedRole(session.impersonated_role);
                  setImpersonatedUserId(session.impersonated_user_id || null);
                  setImpersonatedUserName(session.impersonated_user_name || null);
                  setCurrentLogId(session.impersonation_log_id || null);
                }
              } catch (e) {
                logger.error('Error fetching active impersonation session', e);
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
        passwordResult,
        patientTermsResult
      ] = await Promise.allSettled([
        // 1. Fetch ALL roles and select highest priority
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId),
        
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
          .maybeSingle(),
        
        // 5. Check patient terms acceptance
        supabase
          .from('patient_terms_acceptances')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle()
      ]);

      // Process role with priority order
      let role: string | null = null;
      
      if (roleResult.status === 'fulfilled' && roleResult.value.data) {
        const roles = Array.isArray(roleResult.value.data) 
          ? roleResult.value.data 
          : [roleResult.value.data];
        
        // Priority order: admin > topline > downline > doctor > pharmacy > provider > staff > patient
        const rolePriority: Record<string, number> = {
          admin: 1,
          topline: 2,
          downline: 3,
          doctor: 4,
          pharmacy: 5,
          provider: 6,
          staff: 7,
          patient: 8,
        };
        
        // Sort roles by priority and pick the highest (lowest number)
        const sortedRoles = roles
          .map(r => r.role)
          .sort((a, b) => (rolePriority[a] || 99) - (rolePriority[b] || 99));
        
        role = sortedRoles[0] || null;
      }
      
      // If no role found in user_roles, check if user is a patient
      if (!role) {
        logger.info('No role in user_roles, checking patient_accounts');
        const { data: patientData } = await supabase
          .from('patient_accounts')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();
        
        if (patientData) {
          logger.info('User identified as patient via patient_accounts');
          role = 'patient';
        }
      }
      
      if (!role) throw new Error('No role found');
      
      logger.info('User role fetched (parallel)', { role });
      setUserRole(role);

      // Process provider data with pass-through (only if provider role)
      if (role === 'provider' && providerResult.status === 'fulfilled') {
        const practiceId = providerResult.value.data?.practice_id;
        if (practiceId) {
          console.log('[AuthContext] 🔄 Provider pass-through activated:', {
            originalProviderId: userId,
            actingAsPracticeId: practiceId
          });
          
          // PASS-THROUGH: Make provider act as their practice
          setPracticeParentId(practiceId);
          setOriginalUserId(userId); // Preserve actual provider ID for audit
          setEffectivePracticeId(practiceId);
          
          // Override effectiveUserId and effectiveRole to make provider act as practice
          // Note: This happens after setUserRole, so we need to update computed values
          setImpersonatedRole('doctor'); // Make provider act as doctor/practice admin
          setImpersonatedUserId(practiceId); // Make effectiveUserId be the practice ID
          
          logger.info('Provider pass-through activated', {
            providerId: userId,
            actingAsPracticeId: practiceId
          });
        }
      }

      // Process impersonation permission
      const canImpersonate = impersonationResult.status === 'fulfilled' && impersonationResult.value.data === true;
      setCanImpersonateDb(canImpersonate);

      // Restore impersonation from server if authorized admin
      if (role === 'admin' && canImpersonate) {
        try {
          const { data: { session: authSession } } = await supabase.auth.getSession();
          const token = authSession?.access_token;
          let sessionData: any;
          if (token) {
            ({ data: sessionData } = await supabase.functions.invoke('get-active-impersonation', {
              headers: { Authorization: `Bearer ${token}` }
            }));
          } else {
            ({ data: sessionData } = await supabase.functions.invoke('get-active-impersonation'));
          }
          if (sessionData?.session) {
            const session = sessionData.session;
            setImpersonatedRole(session.impersonated_role);
            setImpersonatedUserId(session.impersonated_user_id || null);
            setImpersonatedUserName(session.impersonated_user_name || null);
            setCurrentLogId(session.impersonation_log_id || null);
          }
        } catch (e) {
          logger.error('Error fetching active impersonation session', e);
        }
      }

      // Process password status
      if (role === 'admin') {
        // Admins ALWAYS exempt, regardless of database value
        setMustChangePassword(false);
        setTermsAccepted(true);
      } else if (passwordResult.status === 'fulfilled' && passwordResult.value.data) {
        setMustChangePassword(passwordResult.value.data.must_change_password || false);
        
        // Check terms acceptance from either user_password_status OR patient_terms_acceptances
        const termsAcceptInStatus = passwordResult.value.data.terms_accepted || false;
        const hasPatientTerms = patientTermsResult.status === 'fulfilled' && patientTermsResult.value.data !== null;
        setTermsAccepted(termsAcceptInStatus || hasPatientTerms);
      } else {
        // FALLBACK: If password check failed, check if patient has terms acceptance
        const hasPatientTerms = patientTermsResult.status === 'fulfilled' && patientTermsResult.value.data !== null;
        logger.warn('Password status check failed, using safe defaults');
        setMustChangePassword(false);
        setTermsAccepted(hasPatientTerms);
      }
      // ALWAYS set this to true, even if checks fail
      setPasswordStatusChecked(true);

      // Defer 2FA status check to avoid blocking initial render
      setTimeout(() => {
        void check2FAStatus(userId);
      }, 100);

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
      logger.info('checkPasswordStatus direct read of user_password_status and profiles');
      
      // Check password status, profile, and patient terms acceptance
      const [passwordStatusResult, profileResult, patientTermsResult] = await Promise.all([
        supabase
          .from('user_password_status')
          .select('must_change_password, terms_accepted')
          .eq('user_id', uid)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('temp_password')
          .eq('id', uid)
          .maybeSingle(),
        supabase
          .from('patient_terms_acceptances')
          .select('id')
          .eq('user_id', uid)
          .maybeSingle()
      ]);

      if (passwordStatusResult.error) {
        logger.error('Error checking password status', passwordStatusResult.error);
        setPasswordStatusChecked(true);
        return { mustChangePassword: false, termsAccepted: false };
      }

      if (profileResult.error) {
        logger.error('Error checking profile temp_password', profileResult.error);
        setPasswordStatusChecked(true);
        return { mustChangePassword: false, termsAccepted: false };
      }

      // Check if user has temp_password flag set
      const hasTempPassword = profileResult.data?.temp_password || false;
      const mustChange = passwordStatusResult.data?.must_change_password || false;
      
      // Check if terms are accepted - either in user_password_status OR patient_terms_acceptances
      const termsAcceptInStatus = passwordStatusResult.data?.terms_accepted || false;
      const hasPatientTermsAcceptance = patientTermsResult.data !== null;
      const termsAccept = termsAcceptInStatus || hasPatientTermsAcceptance;

      // If user has temp_password flag, they must change password regardless of other flags
      const finalMustChange = mustChange || hasTempPassword;

      setMustChangePassword(finalMustChange);
      setTermsAccepted(termsAccept);
      setPasswordStatusChecked(true);

      logger.info('checkPasswordStatus done', { finalMustChange, termsAccept, hasTempPassword });
      return { mustChangePassword: finalMustChange, termsAccepted: termsAccept };
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

  // Failsafe check for session expiration - runs periodically to catch edge cases
  const maybeSignOutIfExpired = () => {
    if (!user?.id) return;
    const expStr = localStorage.getItem(getSessionExpKey(user.id));
    if (!expStr) return;
    
    const remaining = parseInt(expStr) - Date.now();
    if (remaining <= 0) {
      logger.warn('Failsafe triggered: session expired');
      void doHardSignOut();
    }
  };

  // Hard 60-minute session timeout function
  const doHardSignOut = async () => {
    logger.info('Hard session timeout - forcing logout');
    
    // CRITICAL: Capture user ID BEFORE clearing anything
    const userIdToClean = user?.id;
    
    // Clear timers
    if (hardTimerRef.current) {
      clearTimeout(hardTimerRef.current);
      hardTimerRef.current = null;
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
    
    // AGGRESSIVE CLEANUP - do this BEFORE supabase.auth.signOut()
    if (userIdToClean) {
      localStorage.removeItem(getSessionExpKey(userIdToClean));
    }
    
    // Clear 2FA verification for current user
    if (userIdToClean) {
      localStorage.removeItem(`vitaluxe_2fa_verified_until_${userIdToClean}`);
      sessionStorage.removeItem(`vitaluxe_2fa_verified_${userIdToClean}`);
      sessionStorage.removeItem(`vitaluxe_2fa_attempt_${userIdToClean}`);
    }
    
    // Clear auth cache
    sessionStorage.removeItem('vitaluxe_auth_cache');
    
    // Clear impersonation - end server-side session
    try {
      await supabase.functions.invoke('end-impersonation');
    } catch (err) {
      logger.error('Error ending impersonation on hard timeout', err);
    }
    
    // Close impersonation log if active (backup)
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
    
    // NOW sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear session storage reload flag
    sessionStorage.removeItem('chunk_reload_attempted');
    
    // Force immediate state reset
    setSession(null);
    setUser(null);
    setUserRole(null);
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    setTwoFAStatusChecked(false);
    setPasswordStatusChecked(false);
    setIs2FAVerifiedThisSession(false);
    setRequires2FASetup(false);
    setRequires2FAVerify(false);
    
    logger.info('Sign out completed, redirecting with cache-busting reload');
    
    // Use cache-busting full reload to clear stale chunks
    window.location.replace('/auth?ts=' + Date.now());
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // AGGRESSIVE PRE-LOGIN CLEANUP - clear any old session remnants
      // Clear all user-specific session keys (pattern-based cleanup)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('vitaluxe_session_exp_')) {
          localStorage.removeItem(key);
        }
      }
      sessionStorage.removeItem('vitaluxe_auth_cache');
      
      // Clear any old 2FA verification keys (pattern-based cleanup)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('vitaluxe_2fa_verified_until_')) {
          localStorage.removeItem(key);
        }
      }
      
      // Reset 2FA state
      setTwoFAStatusChecked(false);
      setIs2FAVerifiedThisSession(false);
      setRequires2FASetup(false);
      setRequires2FAVerify(false);
      
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
          // Server-side session creation - refresh token to ensure it's valid
          try {
            const { data: { session: authSession }, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !authSession) {
              logger.error('Session refresh failed', refreshError);
              toast.error("Your session has expired. Please log in again.");
              await supabase.auth.signOut();
              return;
            }
            
            const token = authSession.access_token;
            const options: any = {
              body: { 
                role, 
                userId: userId || null, 
                userName: userName || null,
                targetEmail: targetEmail || null
              },
            };
            if (token) options.headers = { Authorization: `Bearer ${token}` };
            const { data, error: sessionError } = await supabase.functions.invoke('start-impersonation', options);
            if (sessionError) {
              logger.error('Error creating server-side impersonation session', sessionError);
              const errorMsg = sessionError.message || 'Failed to create impersonation session';
              toast.error(errorMsg);
              return;
            }
          } catch (err) {
            logger.error('Error calling start-impersonation', err);
            toast.error("Failed to start impersonation");
            return;
          }
        }
      } catch (error) {
        logger.error('Error logging impersonation', error);
        toast.error("Failed to start impersonation session");
        return;
      }
    } else {
      // End server-side session when clearing impersonation
      try {
        await supabase.functions.invoke('end-impersonation');
      } catch (err) {
        logger.error('Error calling end-impersonation', err);
      }
    }
    
    setImpersonatedRole(role);
    setImpersonatedUserId(userId || null);
    setImpersonatedUserName(userName || null);
    
    // Dispatch event to notify pages that impersonation changed
    window.dispatchEvent(new CustomEvent("impersonation-changed", { 
      detail: { effectiveUserId: userId || user?.id || null } 
    }));
    
    if (role) {
      toast.success(`Now viewing as ${userName || role}`);
    } else {
      toast.success("Returned to your Admin account");
    }
  };

  const clearImpersonation = async () => {
    console.log('[AuthContext] Clearing impersonation');
    
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
    
    // End server-side session first
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      let error: any;
      if (token) {
        ({ error } = await supabase.functions.invoke('end-impersonation', {
          headers: { Authorization: `Bearer ${token}` }
        }));
      } else {
        ({ error } = await supabase.functions.invoke('end-impersonation'));
      }
      if (error) {
        logger.error('Error ending impersonation session', error);
      }
      
      // Verify session is actually cleared
      try {
        const { data: sessionCheck } = await supabase.functions.invoke('get-active-impersonation');
        if (sessionCheck?.hasSession) {
          logger.warn('[AuthContext] Impersonation session still active after end attempt');
        } else {
          logger.info('[AuthContext] Impersonation session successfully cleared');
        }
      } catch (verifyError) {
        logger.error('[AuthContext] Error verifying impersonation session ended', verifyError);
      }
    } catch (err) {
      logger.error('Error calling end-impersonation in clearImpersonation', err);
    }
    
    // Clear local state
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    
    // Dispatch event to notify pages that impersonation ended
    window.dispatchEvent(new CustomEvent("impersonation-changed", { 
      detail: { effectiveUserId: user?.id || null } 
    }));
    
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
    if (user?.id) {
      localStorage.removeItem(getSessionExpKey(user.id));
    }
    
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
      const twoFaKey = `vitaluxe_2fa_verified_until_${user.id}`;
      localStorage.removeItem(twoFaKey);
      // Legacy cleanup
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
    // Server-side session already ended by clearCSRFToken or signOut flow
    setLoading(false);
    navigate("/auth");
  };

  const mark2FAVerified = () => {
    console.log('[AuthContext] ✅ mark2FAVerified called');
    if (!user?.id) return;
    const expStr = localStorage.getItem(getSessionExpKey(user.id));
    const expireAt = expStr ? parseInt(expStr) : (Date.now() + HARD_SESSION_TIMEOUT_MS);
    if (user?.id) {
      localStorage.setItem(`vitaluxe_2fa_verified_until_${user.id}`, String(expireAt));
    }
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
      originalUserId,
      canImpersonate,
      isProviderAccount,
      isStaffAccount,
      mustChangePassword,
      termsAccepted,
      passwordStatusChecked,
      requires2FASetup,
      requires2FAVerify,
      user2FAPhone,
      twoFAStatusChecked,
      showIntakeDialog,
      setShowIntakeDialog,
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
