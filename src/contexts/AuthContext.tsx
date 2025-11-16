import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  initializing: boolean;
  effectiveRole: string | null;
  effectiveUserId: string | null;
  effectivePracticeId: string | null;
  userRole: string | null;
  isImpersonating: boolean;
  impersonatedRole: string | null;
  impersonatedUserName: string | null;
  canImpersonate: boolean;
  isProviderAccount: boolean;
  isStaffAccount: boolean;
  mustChangePassword: boolean;
  termsAccepted: boolean;
  passwordStatusChecked: boolean;
  requires2FASetup: boolean;
  requires2FAVerify: boolean;
  user2FAPhone: string | null;
  twoFAStatusChecked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setImpersonation: (userId: string, role: string, name: string) => void;
  clearImpersonation: () => void;
  mark2FAEnrolled: () => void;
  mark2FAVerified: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch to avoid blocking auth state change
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
        setInitializing(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
        }, 0);
      }
      
      setLoading(false);
      setInitializing(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsImpersonating(false);
    setImpersonatedUserId(null);
    setImpersonatedRole(null);
    setImpersonatedUserName(null);
    navigate('/auth');
  };

  const setImpersonation = (userId: string, role: string, name: string) => {
    setIsImpersonating(true);
    setImpersonatedUserId(userId);
    setImpersonatedRole(role);
    setImpersonatedUserName(name);
  };

  const clearImpersonation = () => {
    setIsImpersonating(false);
    setImpersonatedUserId(null);
    setImpersonatedRole(null);
    setImpersonatedUserName(null);
  };

  const mark2FAEnrolled = () => {
    // Placeholder for 2FA enrollment
  };

  const mark2FAVerified = () => {
    // Placeholder for 2FA verification
  };

  // Computed values
  const effectiveUserId = isImpersonating ? impersonatedUserId : user?.id || null;
  const effectiveRole = isImpersonating ? impersonatedRole : profile?.role || null;
  const userRole = profile?.role || null;
  const effectivePracticeId = profile?.practice_id || null;
  const canImpersonate = profile?.role === 'admin' || profile?.role === 'topline';
  const isProviderAccount = profile?.role === 'provider';
  const isStaffAccount = profile?.role === 'staff';

  const value = {
    user,
    session,
    profile,
    loading,
    initializing,
    effectiveRole,
    effectiveUserId,
    effectivePracticeId,
    userRole,
    isImpersonating,
    impersonatedRole,
    impersonatedUserName,
    canImpersonate,
    isProviderAccount,
    isStaffAccount,
    mustChangePassword: false,
    termsAccepted: true,
    passwordStatusChecked: true,
    requires2FASetup: false,
    requires2FAVerify: false,
    user2FAPhone: null,
    twoFAStatusChecked: true,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    setImpersonation,
    clearImpersonation,
    mark2FAEnrolled,
    mark2FAVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
