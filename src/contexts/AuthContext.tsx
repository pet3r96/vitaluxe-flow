import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
  actualRole: string | null;
  impersonatedRole: string | null;
  isImpersonating: boolean;
  effectiveRole: string | null;
  setImpersonation: (role: string | null) => void;
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

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const actualRole = userRole;
  const isImpersonating = impersonatedRole !== null;
  const effectiveRole = impersonatedRole || userRole;

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

      // Restore impersonation from sessionStorage if admin
      if (role === 'admin') {
        const stored = sessionStorage.getItem('vitaluxe_impersonation');
        if (stored) {
          try {
            const { role: impRole } = JSON.parse(stored);
            setImpersonatedRole(impRole);
          } catch (e) {
            sessionStorage.removeItem('vitaluxe_impersonation');
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
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (!error) {
        navigate("/dashboard");
      }
      
      return { error };
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

  const setImpersonation = (role: string | null) => {
    if (userRole !== 'admin') return;
    
    setImpersonatedRole(role);
    if (role) {
      sessionStorage.setItem('vitaluxe_impersonation', JSON.stringify({ role, timestamp: Date.now() }));
    } else {
      sessionStorage.removeItem('vitaluxe_impersonation');
    }
  };

  const clearImpersonation = () => {
    setImpersonatedRole(null);
    sessionStorage.removeItem('vitaluxe_impersonation');
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    setImpersonatedRole(null);
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
      isImpersonating,
      effectiveRole,
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
