import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Discount Service
 * Handles discount code management and validation
 */

export interface DiscountCode {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  validUntil: string;
  maxUses: number | null;
  timesUsed: number;
  active: boolean;
}

/**
 * Get all active discount codes for practice
 */
export async function getActiveDiscountCodes(
  practiceId: string
): Promise<DiscountCode[]> {
  try {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .eq("practice_id", practiceId)
      .eq("active", true)
      .gte("valid_until", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[DiscountService] Failed to get discount codes", error);
      return [];
    }

    return data.map((code) => ({
      id: code.id,
      code: code.code,
      discountType: code.discount_type,
      discountValue: code.discount_value,
      validUntil: code.valid_until,
      maxUses: code.max_uses,
      timesUsed: code.times_used,
      active: code.active,
    }));
  } catch (error) {
    logger.error("[DiscountService] Error getting discount codes", error);
    return [];
  }
}

/**
 * Validate discount code
 */
export async function validateDiscountCode(
  code: string,
  practiceId: string
): Promise<{
  valid: boolean;
  discount?: { type: string; value: number };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from("discount_codes")
      .select("*")
      .eq("code", code)
      .eq("practice_id", practiceId)
      .eq("active", true)
      .gte("valid_until", new Date().toISOString())
      .single();

    if (error || !data) {
      return { valid: false, error: "Invalid or expired discount code" };
    }

    // Check usage limits
    if (data.max_uses && data.times_used >= data.max_uses) {
      return { valid: false, error: "Discount code has reached maximum uses" };
    }

    return {
      valid: true,
      discount: {
        type: data.discount_type,
        value: data.discount_value,
      },
    };
  } catch (error) {
    logger.error("[DiscountService] Error validating discount code", error);
    return { valid: false, error: "Failed to validate discount code" };
  }
}

/**
 * Calculate discount amount
 */
export function calculateDiscountAmount(
  subtotal: number,
  discountType: "percentage" | "fixed",
  discountValue: number
): number {
  if (discountType === "percentage") {
    return (subtotal * discountValue) / 100;
  }
  return Math.min(discountValue, subtotal);
}

/**
 * Apply discount to order
 */
export async function applyDiscountToOrder(
  orderId: string,
  discountCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("orders")
      .update({ discount_code: discountCode })
      .eq("id", orderId);

    if (error) {
      logger.error("[DiscountService] Failed to apply discount", error);
      return { success: false, error: error.message };
    }

    // Increment usage count
    await supabase.rpc("increment_discount_usage", { p_code: discountCode });

    return { success: true };
  } catch (error) {
    logger.error("[DiscountService] Error applying discount", error);
    return { success: false, error: "Failed to apply discount" };
  }
}

/**
 * Create discount code
 */
export async function createDiscountCode(
  practiceId: string,
  code: string,
  discountType: "percentage" | "fixed",
  discountValue: number,
  validUntil: string,
  maxUses?: number
): Promise<{ success: boolean; codeId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("discount_codes")
      .insert({
        practice_id: practiceId,
        code: code.toUpperCase(),
        discount_type: discountType,
        discount_value: discountValue,
        valid_until: validUntil,
        max_uses: maxUses || null,
        active: true,
      })
      .select("id")
      .single();

    if (error) {
      logger.error("[DiscountService] Failed to create discount code", error);
      return { success: false, error: error.message };
    }

    return { success: true, codeId: data.id };
  } catch (error) {
    logger.error("[DiscountService] Error creating discount code", error);
    return { success: false, error: "Failed to create discount code" };
  }
}

/**
 * Deactivate discount code
 */
export async function deactivateDiscountCode(
  codeId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("discount_codes")
      .update({ active: false })
      .eq("id", codeId);

    if (error) {
      logger.error("[DiscountService] Failed to deactivate code", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[DiscountService] Error deactivating code", error);
    return { success: false, error: "Failed to deactivate discount code" };
  }
}
