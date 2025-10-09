import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
  canImpersonate: boolean;
  setImpersonation: (role: string | null, userId?: string | null, userName?: string | null, targetEmail?: string | null) => void;
  clearImpersonation: () => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (
    email: string, 
    password: string, 
    name: string, 
    role: string, 
    roleData: any
  ) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AUTHORIZED_IMPERSONATOR_EMAIL = 'admin@vitaluxeservice.com';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);
  const [currentLogId, setCurrentLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const actualRole = userRole;
  const isImpersonating = impersonatedRole !== null;
  const effectiveRole = impersonatedRole || userRole;
  const effectiveUserId = impersonatedUserId || user?.id || null;
  const canImpersonate = userRole === 'admin' && user?.email === AUTHORIZED_IMPERSONATOR_EMAIL;

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Fetch user role in a deferred manner
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
          setImpersonatedRole(null);
          setImpersonatedUserId(null);
          setImpersonatedUserName(null);
          setCurrentLogId(null);
          sessionStorage.removeItem('vitaluxe_impersonation');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

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
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      const role = data?.role ?? null;
      setUserRole(role);

      // Restore impersonation from sessionStorage if authorized admin
      if (role === 'admin') {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email === AUTHORIZED_IMPERSONATOR_EMAIL) {
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
    } catch (error) {
      console.error("Error fetching user role:", error);
      setUserRole(null);
    }
  };

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
    roleData: any
  ) => {
    try {
      // Call the edge function to handle user creation and role assignment
      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email,
          password,
          name,
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
    
    await supabase.auth.signOut();
    setUserRole(null);
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setCurrentLogId(null);
    sessionStorage.removeItem('vitaluxe_impersonation');
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      loading, 
      actualRole,
      impersonatedRole,
      impersonatedUserId,
      impersonatedUserName,
      isImpersonating,
      effectiveRole,
      effectiveUserId,
      canImpersonate,
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
