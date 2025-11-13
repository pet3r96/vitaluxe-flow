import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Two-Factor Authentication Service
 * Handles 2FA setup, verification, and status checks
 */

export interface TwoFactorStatus {
  requiresSetup: boolean;
  requiresVerify: boolean;
  phoneNumber: string | null;
}

/**
 * Check 2FA status for user
 */
export async function checkTwoFactorStatus(
  userId: string
): Promise<TwoFactorStatus> {
  try {
    // Check if 2FA is globally enabled
    const { data: settings } = await supabase
      .from("system_settings")
      .select("two_factor_enabled")
      .single();

    if (!settings?.two_factor_enabled) {
      return {
        requiresSetup: false,
        requiresVerify: false,
        phoneNumber: null,
      };
    }

    // Check user's 2FA enrollment
    const { data: userData } = await supabase
      .from("user_roles")
      .select("two_factor_phone, two_factor_enabled")
      .eq("user_id", userId)
      .single();

    if (!userData) {
      return {
        requiresSetup: true,
        requiresVerify: false,
        phoneNumber: null,
      };
    }

    // User hasn't enrolled yet
    if (!userData.two_factor_phone) {
      return {
        requiresSetup: true,
        requiresVerify: false,
        phoneNumber: null,
      };
    }

    // Check if this session is verified
    const { data: sessionData } = await supabase
      .from("user_sessions")
      .select("two_factor_verified")
      .eq("user_id", userId)
      .gte("expires_at", new Date().toISOString())
      .single();

    const requiresVerify = !sessionData?.two_factor_verified;

    return {
      requiresSetup: false,
      requiresVerify,
      phoneNumber: userData.two_factor_phone,
    };
  } catch (error) {
    logger.error("[TwoFactorService] Error checking 2FA status", error);
    return {
      requiresSetup: false,
      requiresVerify: false,
      phoneNumber: null,
    };
  }
}

/**
 * Setup 2FA for user
 */
export async function setupTwoFactor(
  userId: string,
  phoneNumber: string,
  verificationCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("ghl-sms-verify", {
      body: {
        userId,
        phoneNumber,
        code: verificationCode,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[TwoFactorService] Error setting up 2FA", error);
    return { success: false, error: "Failed to setup 2FA" };
  }
}

/**
 * Verify 2FA code for current session
 */
export async function verifyTwoFactor(
  userId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "ghl-sms-verify-session",
      {
        body: {
          userId,
          code,
        },
      }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[TwoFactorService] Error verifying 2FA", error);
    return { success: false, error: "Failed to verify 2FA" };
  }
}

/**
 * Send 2FA verification code via SMS
 */
export async function sendTwoFactorCode(
  userId: string,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke("ghl-sms-send", {
      body: {
        userId,
        phoneNumber,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[TwoFactorService] Error sending 2FA code", error);
    return { success: false, error: "Failed to send 2FA code" };
  }
}
