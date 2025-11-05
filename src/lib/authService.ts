import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getCurrentCSRFToken } from "@/lib/csrf";

/**
 * Unified Auth Service Layer
 * Centralizes all authentication logic for signup, login, and verification flows
 */

export interface SignupUserParams {
  email: string;
  password: string;
  name: string;
  role: string;
  roleData: any;
  fullName?: string;
  prescriberName?: string;
}

export interface CreateUserByAdminParams {
  email: string;
  name: string;
  role: string;
  roleData: any;
  adminId: string;
  fullName?: string;
  prescriberName?: string;
}

export const authService = {
  /**
   * Self-signup flow (with email verification)
   * 1. Create auth user (email_confirm: false)
   * 2. Call assign-user-role with status='pending_verification'
   * 3. Trigger send-verification-email
   * 4. Return success message
   */
  signupUser: async (params: SignupUserParams): Promise<{ error: any }> => {
    try {
      const { email, password, name, role, roleData, fullName, prescriberName } = params;

      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      if (existingProfile) {
        return { 
          error: { 
            message: 'This email address is already registered. Please use a different email or try logging in.' 
          } 
        };
      }

      // Get CSRF token
      const csrfToken = await getCurrentCSRFToken();

      // Call assign-user-role edge function for self-signup
      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email,
          password,
          name,
          fullName,
          prescriberName,
          role,
          roleData,
          isSelfSignup: true, // Flag to indicate self-signup flow
          csrfToken,
        },
        headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
      });

      if (error) {
        logger.error('Self-signup error', error);
        return { error: { message: (data as any)?.error || error.message } };
      }

      if (data?.error) {
        logger.error('Self-signup validation error', new Error(data.error));
        return { error: { message: data.error } };
      }

      // Success - verification email sent
      return { error: null };
    } catch (error: any) {
      logger.error('Unexpected signup error', error);
      return { error: { message: error.message || 'An unexpected error occurred during signup' } };
    }
  },

  /**
   * Admin-created user flow (with temporary password)
   * 1. Generate temp password (done in edge function)
   * 2. Create auth user (email_confirm: true)
   * 3. Call assign-user-role with created_by=adminId, temp_password=true
   * 4. Trigger send-temp-password-email
   * 5. Return success
   */
  createUserByAdmin: async (params: CreateUserByAdminParams): Promise<{ error: any }> => {
    try {
      const { email, name, role, roleData, adminId, fullName, prescriberName } = params;

      // Check if email already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('email')
        .ilike('email', email)
        .maybeSingle();

      if (existingProfile) {
        return { 
          error: { 
            message: 'This email address is already registered in the system.' 
          } 
        };
      }

      // Get CSRF token
      const csrfToken = await getCurrentCSRFToken();

      // Call assign-user-role edge function for admin-created user
      const { data, error } = await supabase.functions.invoke('assign-user-role', {
        body: {
          email,
          name,
          fullName,
          prescriberName,
          role,
          roleData,
          isAdminCreated: true, // Flag to indicate admin-created user
          createdBy: adminId,
          csrfToken,
        },
        headers: csrfToken ? { 'x-csrf-token': csrfToken } : {},
      });

      if (error) {
        logger.error('Admin user creation error', error);
        return { error: { message: (data as any)?.error || error.message } };
      }

      if (data?.error) {
        logger.error('Admin user creation validation error', new Error(data.error));
        return { error: { message: data.error } };
      }

      // Success - temp password email sent
      return { error: null };
    } catch (error: any) {
      logger.error('Unexpected admin user creation error', error);
      return { error: { message: error.message || 'An unexpected error occurred' } };
    }
  },

  /**
   * Login flow
   * 1. Check profile status (must be 'active')
   * 2. Sign in with Supabase
   * 3. Check temp_password flag → force password reset if needed
   */
  loginUser: async (email: string, password: string): Promise<{ error: any }> => {
    try {
      // Normalize credentials to avoid common input issues (e.g., copy/paste spaces)
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      // Attempt sign in
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (error) {
        return { error };
      }

      if (!user) {
        return { error: { message: 'Login failed. Please check your credentials.' } };
      }

      // Check account status
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('active, status, temp_password')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error("Error checking account status", profileError);
        await supabase.auth.signOut();
        return { error: { message: "Unable to verify account status" } };
      }

      // Check if account is disabled
      if (!profile?.active) {
        await supabase.auth.signOut();
        return { 
          error: { 
            message: "🚫 Your account has been disabled. Please contact support at support@vitaluxeservices.com" 
          } 
        };
      }

      // Check if this is a patient account and if it's disabled
      const { data: patientAccount } = await supabase
        .from('patient_accounts')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      if (patientAccount && patientAccount.status === 'disabled') {
        await supabase.auth.signOut();
        return {
          error: {
            code: 'account_disabled',
            message: "Your account has been disabled. Please contact your practice for assistance."
          }
        };
      }

    // Check if account is verified
    if (profile?.status === 'pending_verification') {
      await supabase.auth.signOut();
      return {
        error: {
          code: 'email_not_verified',
          email: email,
          message: "Email not verified",
        },
      };
    }

    // Check if user has temporary password - prevent login
    if (profile?.temp_password === true) {
      await supabase.auth.signOut();
      return {
        error: {
          code: 'temp_password_required',
          email: email,
          message: "You must change your temporary password before logging in. Please use the link in your welcome email to set a new password.",
        },
      };
    }

      // Login successful
      return { error: null };
    } catch (error: any) {
      logger.error('Unexpected login error', error);
      return { error: { message: error.message || 'An unexpected error occurred during login' } };
    }
  },

  /**
   * Email verification flow
   * Calls verify-email edge function with token
   */
  verifyEmail: async (token: string): Promise<{ error: any; message?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('verify-email', {
        body: { token },
      });

      if (error) {
        logger.error('Email verification error', error);
        return { error: { message: (data as any)?.error || error.message } };
      }

      if (data?.error) {
        return { error: { message: data.error } };
      }

      return { error: null, message: data?.message || 'Email verified successfully!' };
    } catch (error: any) {
      logger.error('Unexpected email verification error', error);
      return { error: { message: error.message || 'An unexpected error occurred' } };
    }
  },
};
