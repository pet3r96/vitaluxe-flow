import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  email: string;
  role?: string;
  active: boolean;
  practice_id?: string;
  linked_topline_id?: string;
  [key: string]: any;
}

interface Provider {
  id: string;
  user_id: string;
  practice_id: string;
  role_type: string;
  active: boolean;
  can_order: boolean;
}

interface Staff {
  id: string;
  user_id: string;
  practice_id: string;
  role_type: string;
  active: boolean;
  can_order: boolean;
}

interface ImpersonationSession {
  originalUserId: string;
  impersonatedUserId: string;
  impersonatedRole: string;
  impersonatedName: string;
  startedAt: string;
}

interface AuthContextType {
  // Core auth
  user: User | null;
  session: Session | null;
  loading: boolean;
  initializing: boolean;
  
  // User data
  profile: Profile | null;
  roles: string[];
  practice: any | null;
  provider: Provider | null;
  staff: Staff | null;
  
  // Computed values for backward compatibility
  effectiveRole: string | null;
  effectiveUserId: string | null;
  effectivePracticeId: string | null;
  userRole: string | null;
  canImpersonate: boolean;
  isProviderAccount: boolean;
  isStaffAccount: boolean;
  
  // Impersonation
  isImpersonating: boolean;
  impersonatedRole: string | null;
  impersonatedUserName: string | null;
  impersonatedUserId: string | null;
  impersonationSession: ImpersonationSession | null;
  
  // Placeholder fields for backward compatibility
  mustChangePassword: boolean;
  termsAccepted: boolean;
  passwordStatusChecked: boolean;
  requires2FASetup: boolean;
  requires2FAVerify: boolean;
  user2FAPhone: string | null;
  twoFAStatusChecked: boolean;
  actualRole: string | null;
  checkPasswordStatus: () => void;
  
  // Auth methods
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  
  // Impersonation methods
  startImpersonation: (targetUserId: string, targetRole: string, targetName: string) => Promise<void>;
  stopImpersonation: () => Promise<void>;
  setImpersonation: (userId: string, role: string, name: string) => void;
  clearImpersonation: () => void;
  mark2FAEnrolled: () => void;
  mark2FAVerified: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [practice, setPractice] = useState<any | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  
  const [impersonationSession, setImpersonationSession] = useState<ImpersonationSession | null>(null);
  const navigate = useNavigate();

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as any);

      // Fetch roles from user_roles table
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
      
      const userRoles = rolesData?.map(r => r.role) || [];
      // Add profile.role to roles if it exists for backward compatibility
      if (profileData?.role && !userRoles.includes(profileData.role)) {
        userRoles.push(profileData.role);
      }
      setRoles(userRoles);

      // Fetch provider info if applicable
      const { data: providerData } = await supabase
        .from('providers')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      setProvider(providerData as any);

      // Fetch staff info if applicable
      const { data: staffData } = await supabase
        .from('practice_staff')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      
      setStaff(staffData as any);

      // Fetch practice info if user is linked to a practice
      const practiceId = providerData?.practice_id || staffData?.practice_id;
      if (practiceId) {
        const { data: practiceData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', practiceId)
          .maybeSingle();
        
        setPractice(practiceData);
      } else if (profileData?.role === 'practice' || profileData?.role === 'doctor') {
        // If user themselves is a practice, set practice to their profile
        setPractice(profileData);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      setProfile(null);
      setRoles([]);
      setPractice(null);
      setProvider(null);
      setStaff(null);
    }
  };

  const refreshProfile = async () => {
    const userId = impersonationSession?.impersonatedUserId || user?.id;
    if (userId) {
      await fetchUserData(userId);
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer user data fetch to avoid blocking auth state change
        if (session?.user && !impersonationSession) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else if (!session) {
          setProfile(null);
          setRoles([]);
          setPractice(null);
          setProvider(null);
          setStaff(null);
        }
        
        setLoading(false);
        setInitializing(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user && !impersonationSession) {
        setTimeout(() => {
          fetchUserData(session.user.id);
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
    await stopImpersonation();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setPractice(null);
    setProvider(null);
    setStaff(null);
    navigate('/auth');
  };

  const startImpersonation = async (targetUserId: string, targetRole: string, targetName: string) => {
    if (!user) return;
    
    // Check if current user is admin
    if (!roles.includes('admin')) {
      console.error('Only admins can impersonate');
      return;
    }

    // Check target user roles
    const { data: targetRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId);
    
    const targetUserRoles = targetRoles?.map(r => r.role) || [];

    // Admin cannot impersonate another admin
    if (targetUserRoles.includes('admin')) {
      console.error('Cannot impersonate admin users');
      return;
    }

    // Admin cannot impersonate themselves
    if (targetUserId === user.id) {
      console.error('Cannot impersonate yourself');
      return;
    }

    const session: ImpersonationSession = {
      originalUserId: user.id,
      impersonatedUserId: targetUserId,
      impersonatedRole: targetRole,
      impersonatedName: targetName,
      startedAt: new Date().toISOString(),
    };

    setImpersonationSession(session);
    
    // Fetch impersonated user data
    await fetchUserData(targetUserId);
  };

  const stopImpersonation = async () => {
    if (!impersonationSession) return;
    
    const originalUserId = impersonationSession.originalUserId;
    setImpersonationSession(null);
    
    // Restore original user data
    if (originalUserId) {
      await fetchUserData(originalUserId);
    }
  };

  // Backward compatibility methods
  const setImpersonation = (userId: string, role: string, name: string) => {
    startImpersonation(userId, role, name);
  };

  const clearImpersonation = () => {
    stopImpersonation();
  };

  const mark2FAEnrolled = () => {
    // Placeholder for 2FA enrollment
  };

  const mark2FAVerified = () => {
    // Placeholder for 2FA verification
  };

  const checkPasswordStatus = () => {
    // Placeholder for password status check
  };

  // Computed values
  const effectiveUserId = impersonationSession?.impersonatedUserId || user?.id || null;
  const effectiveRole = impersonationSession?.impersonatedRole || profile?.role || roles[0] || null;
  const userRole = profile?.role || roles[0] || null;
  const effectivePracticeId = practice?.id || profile?.practice_id || provider?.practice_id || staff?.practice_id || null;
  const canImpersonate = roles.includes('admin') || roles.includes('topline');
  const isProviderAccount = !!provider || roles.includes('provider');
  const isStaffAccount = !!staff || roles.includes('staff');
  const isImpersonating = !!impersonationSession;
  const impersonatedRole = impersonationSession?.impersonatedRole || null;
  const impersonatedUserName = impersonationSession?.impersonatedName || null;
  const impersonatedUserId = impersonationSession?.impersonatedUserId || null;

  const value: AuthContextType = {
    user,
    session,
    loading,
    initializing,
    profile,
    roles,
    practice,
    provider,
    staff,
    effectiveRole,
    effectiveUserId,
    effectivePracticeId,
    userRole,
    canImpersonate,
    isProviderAccount,
    isStaffAccount,
    isImpersonating,
    impersonatedRole,
    impersonatedUserName,
    impersonatedUserId,
    impersonationSession,
    mustChangePassword: false,
    termsAccepted: true,
    passwordStatusChecked: true,
    requires2FASetup: false,
    requires2FAVerify: false,
    user2FAPhone: null,
    twoFAStatusChecked: true,
    actualRole: userRole,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    startImpersonation,
    stopImpersonation,
    setImpersonation,
    clearImpersonation,
    mark2FAEnrolled,
    mark2FAVerified,
    checkPasswordStatus,
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
