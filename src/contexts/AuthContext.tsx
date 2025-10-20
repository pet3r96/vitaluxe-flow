import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { generateCSRFToken, clearCSRFToken } from "@/lib/csrf";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
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
  checkPasswordStatus: () => Promise<{ mustChangePassword: boolean; termsAccepted: boolean }>;
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
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true); // Tracks if user data is still loading
  const [isProviderAccount, setIsProviderAccount] = useState(false);
  const [effectivePracticeId, setEffectivePracticeId] = useState<string | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [canImpersonateDb, setCanImpersonateDb] = useState(false);
  const [requires2FASetup, setRequires2FASetup] = useState(false);
  const [requires2FAVerify, setRequires2FAVerify] = useState(false);
  const [user2FAPhone, setUser2FAPhone] = useState<string | null>(null);
  const navigate = useNavigate();

  const actualRole = userRole;
  const isImpersonating = impersonatedRole !== null;
  const effectiveRole = impersonatedRole || userRole;
  const effectiveUserId = impersonatedUserId || user?.id || null;
  const canImpersonate = userRole === 'admin' && canImpersonateDb;

  // Function to check 2FA status
  const check2FAStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_2fa_settings')
        .select('is_enrolled, phone_verified, phone_number')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // No 2FA settings - need setup
        setRequires2FASetup(true);
        setRequires2FAVerify(false);
        setUser2FAPhone(null);
      } else if (data.is_enrolled && data.phone_verified) {
        // Has 2FA enrolled - need verification on login
        setRequires2FAVerify(true);
        setRequires2FASetup(false);
        setUser2FAPhone(data.phone_number);
      } else {
        // Incomplete enrollment - need setup
        setRequires2FASetup(true);
        setRequires2FAVerify(false);
        setUser2FAPhone(null);
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
      setRequires2FASetup(false);
      setRequires2FAVerify(false);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, 'has session:', !!session);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role in a deferred manner
          setTimeout(() => {
            fetchUserRole(session.user.id);
            // Regenerate CSRF token on auth state restoration
            generateCSRFToken();
          }, 0);
        } else {
          setUserRole(null);
          setImpersonatedRole(null);
          setImpersonatedUserId(null);
          setImpersonatedUserName(null);
          setCurrentLogId(null);
          sessionStorage.removeItem('vitaluxe_impersonation');
          clearCSRFToken();
          setDataLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setDataLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check impersonation permission from database
  useEffect(() => {
    const checkImpersonationPermission = async () => {
      if (!user?.id || userRole !== 'admin') {
        setCanImpersonateDb(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('can_user_impersonate', {
          _user_id: user.id
        });

        if (!error && data === true) {
          setCanImpersonateDb(true);
        } else {
          setCanImpersonateDb(false);
        }
      } catch (error) {
        console.error('Error checking impersonation permission:', error);
        setCanImpersonateDb(false);
      }
    };

    checkImpersonationPermission();
  }, [user?.id, userRole]);

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
            if (error) console.debug('Auth: provider practice lookup error', error);
          }
        } else {
          // Admin or other roles
          setEffectivePracticeId(null);
          setIsProviderAccount(false);
        }
      } catch (error) {
        console.error('Error checking provider status and practice:', error);
        setIsProviderAccount(false);
        setEffectivePracticeId(null);
      }
    };

    checkProviderStatusAndPractice();
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
            setTimeout(async () => {
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
                  console.error('Error ending impersonation log on deactivation:', e);
                }
              }
              
              await supabase.auth.signOut();
              setUserRole(null);
              setImpersonatedRole(null);
              setImpersonatedUserId(null);
              setImpersonatedUserName(null);
              setCurrentLogId(null);
              sessionStorage.removeItem('vitaluxe_impersonation');
              navigate("/auth");
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  const fetchUserRole = async (userId: string) => {
    try {
      setDataLoading(true);
      console.log('Fetching user role for userId:', userId);
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      const role = data?.role ?? null;
      console.log('User role fetched:', role);
      setUserRole(role);

      // If provider role, fetch practice_id from providers table
      if (role === 'provider' as any) {
        const { data: providerData } = await supabase
          .from('providers' as any)
          .select('practice_id')
          .eq('user_id', userId)
          .single();
        
        if (providerData) {
          setPracticeParentId((providerData as any).practice_id);
        }
      }

      // Restore impersonation from sessionStorage if authorized admin
      if (role === 'admin') {
        // Check database permission before restoring impersonation
        const { data: canImpersonate } = await supabase.rpc('can_user_impersonate', {
          _user_id: userId
        });
        
        if (canImpersonate === true) {
          const stored = sessionStorage.getItem('vitaluxe_impersonation');
          if (stored) {
            try {
              const { role: impRole, userId, userName, logId } = JSON.parse(stored);
              setImpersonatedRole(impRole);
              setImpersonatedUserId(userId || null);
              setImpersonatedUserName(userName || null);
              setCurrentLogId(logId || null);
            } catch (e) {
              sessionStorage.removeItem('vitaluxe_impersonation');
            }
          }
        }
      }

      // Now that role is loaded, check password status and 2FA
      console.log('Checking password status and 2FA for role:', role);
      await checkPasswordStatus();
      await check2FAStatus(userId);
      
      console.log('All user data loaded, setting dataLoading to false');
      setDataLoading(false);
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole(null);
      setDataLoading(false);
    }
  };

  const checkPasswordStatus = async (): Promise<{ mustChangePassword: boolean; termsAccepted: boolean }> => {
    if (!user) {
      return { mustChangePassword: false, termsAccepted: true };
    }

    // Only real admins (not impersonating) are exempt from both password change and terms acceptance
    if (effectiveRole === 'admin' && !isImpersonating) {
      setMustChangePassword(false);
      setTermsAccepted(true);
      return { mustChangePassword: false, termsAccepted: true };
    }

    try {
      const { data, error } = await supabase
        .from('user_password_status')
        .select('must_change_password, terms_accepted')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) {
        console.error('Error checking password status:', error);
        return { mustChangePassword: false, termsAccepted: false };
      }

      const mustChange = data?.must_change_password || false;
      const termsAccept = data?.terms_accepted || false;
      
      setMustChangePassword(mustChange);
      setTermsAccepted(termsAccept);
      
      return { mustChangePassword: mustChange, termsAccepted: termsAccept };
    } catch (error) {
      console.error('Error in checkPasswordStatus:', error);
      return { mustChangePassword: false, termsAccepted: false };
    }
  };

  // Re-check password status when impersonation changes (but not on initial load)
  useEffect(() => {
    if (user && effectiveUserId && effectiveRole && !dataLoading) {
      console.log('Re-checking password status due to impersonation change');
      checkPasswordStatus();
    }
  }, [effectiveUserId, effectiveRole]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) return { error };

      // Check if account is active before allowing login
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error("Error checking account status:", profileError);
        await supabase.auth.signOut();
        return { error: { message: "Unable to verify account status" } };
      }

      if (!profile?.active) {
        await supabase.auth.signOut();
        return { 
          error: { 
            message: "🚫 Your account has been disabled. Please contact support at support@vitaluxe.com" 
          } 
        };
      }

      // Check 2FA status after successful login
      await check2FAStatus(user.id);

      // Check password status after successful login
      await checkPasswordStatus();

      // Generate CSRF token after successful authentication
      const csrfToken = await generateCSRFToken();
      if (!csrfToken) {
        console.warn('Failed to generate CSRF token - some operations may be restricted');
      }

      navigate("/dashboard");
      return { error: null };
    } catch (error: any) {
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
    try {
      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', email)
        .single();

      if (existingProfile) {
        return { error: { message: 'User already exists in the system. Please use a different email address.' } };
      }

      // Call the edge function to handle user creation and role assignment
      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email,
          password,
          name,
          fullName,
          prescriberName,
          role,
          roleData,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        return { error: { message: error.message } };
      }

      if (data?.error) {
        console.error('Signup error:', data.error);
        return { error: { message: data.error } };
      }

      return { error: null };
    } catch (error: any) {
      console.error('Unexpected signup error:', error);
      return { error: { message: error.message || 'An unexpected error occurred' } };
    }
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
        console.error('Error updating impersonation log:', error);
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
          console.error('Error creating impersonation log:', logError);
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
        console.error('Error logging impersonation:', error);
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
        console.error('Error updating impersonation log:', error);
      }
    }
    
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    sessionStorage.removeItem('vitaluxe_impersonation');
    toast.success("Returned to your Admin account");
  };

  const signOut = async () => {
    // End impersonation log if active
    if (currentLogId) {
      try {
        await supabase
          .from('impersonation_logs')
          .update({ end_time: new Date().toISOString() })
          .eq('id', currentLogId);
      } catch (error) {
        console.error('Error updating impersonation log on signout:', error);
      }
    }
    
    // Clear CSRF token before signing out
    clearCSRFToken();
    
    await supabase.auth.signOut();
    setUserRole(null);
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    sessionStorage.removeItem('vitaluxe_impersonation');
    navigate("/auth");
  };

  // Combine loading states - only ready when both auth and data are loaded
  const isFullyLoaded = !loading && !dataLoading;
  
  console.log('AuthContext state:', { 
    loading, 
    dataLoading, 
    isFullyLoaded,
    effectiveRole, 
    mustChangePassword, 
    termsAccepted,
    user: !!user 
  });

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      loading: !isFullyLoaded, // Combined loading state
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
      requires2FASetup,
      requires2FAVerify,
      user2FAPhone,
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
