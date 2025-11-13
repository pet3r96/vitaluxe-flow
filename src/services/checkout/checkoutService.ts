import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Checkout Service
 * Handles checkout process and order creation
 */

export interface CheckoutData {
  cartId: string;
  shippingAddressId?: string;
  billingAddressId?: string;
  paymentMethodId?: string;
  discountCode?: string;
  notes?: string;
}

export interface OrderSummary {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
}

/**
 * Process checkout and create order
 */
export async function processCheckout(
  data: CheckoutData
): Promise<{ success: boolean; order?: OrderSummary; error?: string }> {
  try {
    const { data: result, error } = await supabase.functions.invoke(
      "process-checkout",
      {
        body: data,
      }
    );

    if (error) {
      logger.error("[CheckoutService] Checkout failed", error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      order: result,
    };
  } catch (error) {
    logger.error("[CheckoutService] Error processing checkout", error);
    return { success: false, error: "Failed to process checkout" };
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
    logger.error("[CheckoutService] Error validating discount code", error);
    return { valid: false, error: "Failed to validate discount code" };
  }
}

/**
 * Calculate order totals
 */
export async function calculateOrderTotals(
  cartId: string,
  discountCode?: string
): Promise<{
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
} | null> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "calculate-order-totals",
      {
        body: { cartId, discountCode },
      }
    );

    if (error) {
      logger.error("[CheckoutService] Failed to calculate totals", error);
      return null;
    }

    return data;
  } catch (error) {
    logger.error("[CheckoutService] Error calculating totals", error);
    return null;
  }
}

/**
 * Apply discount code to order
 */
export async function applyDiscountCode(
  code: string,
  orderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("orders")
      .update({ discount_code: code })
      .eq("id", orderId);

    if (error) {
      logger.error("[CheckoutService] Failed to apply discount", error);
      return { success: false, error: error.message };
    }

    // Increment discount usage
    await supabase.rpc("increment_discount_usage", { p_code: code });

    return { success: true };
  } catch (error) {
    logger.error("[CheckoutService] Error applying discount", error);
    return { success: false, error: "Failed to apply discount code" };
  }
}
