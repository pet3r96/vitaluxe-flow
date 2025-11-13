import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Password Management Service
 * Handles password changes and validation
 */

/**
 * Check if user must change password
 */
export async function mustChangePassword(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("must_change_password")
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.must_change_password || false;
  } catch (error) {
    logger.error("[PasswordService] Error checking must change password", error);
    return false;
  }
}

/**
 * Update user password
 */
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verify current password by attempting to sign in
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) {
      return { success: false, error: "User not found" };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { success: false, error: "Current password is incorrect" };
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Clear must_change_password flag
    const { error: flagError } = await supabase
      .from("user_roles")
      .update({ must_change_password: false })
      .eq("user_id", user.id);

    if (flagError) {
      logger.error("[PasswordService] Failed to clear must_change_password flag", flagError);
    }

    return { success: true };
  } catch (error) {
    logger.error("[PasswordService] Error updating password", error);
    return { success: false, error: "Failed to update password" };
  }
}

/**
 * Force password change for user (admin action)
 */
export async function forcePasswordChange(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("user_roles")
      .update({ must_change_password: true })
      .eq("user_id", userId);

    if (error) {
      logger.error("[PasswordService] Failed to force password change", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[PasswordService] Error forcing password change", error);
    return false;
  }
}
