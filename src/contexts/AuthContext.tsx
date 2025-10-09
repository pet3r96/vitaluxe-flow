import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: string | null;
  loading: boolean;
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
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      setUserRole(data?.role ?? null);
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

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    navigate("/auth");
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signIn, signUp, signOut }}>
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
