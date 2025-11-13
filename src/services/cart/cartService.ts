import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Cart Service
 * Handles all cart-related business logic
 */

export interface CartLine {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  patient_id: string | null;
  patient_first_name: string | null;
  patient_last_name: string | null;
  shipping_address_id: string | null;
  expires_at: string;
}

export interface Cart {
  id: string;
  doctor_id: string;
  lines: CartLine[];
}

/**
 * Get or create cart for user
 */
export async function getOrCreateCart(userId: string): Promise<Cart | null> {
  try {
    // Try to get existing cart
    let { data: cart, error } = await supabase
      .from("cart")
      .select("id, doctor_id")
      .eq("doctor_id", userId)
      .maybeSingle();

    // Create cart if it doesn't exist
    if (!cart) {
      const { data: newCart, error: createError } = await supabase
        .from("cart")
        .insert({ doctor_id: userId })
        .select("id, doctor_id")
        .single();

      if (createError) {
        logger.error("[CartService] Failed to create cart", createError);
        return null;
      }

      cart = newCart;
    }

    return {
      id: cart.id,
      doctor_id: cart.doctor_id,
      lines: [],
    };
  } catch (error) {
    logger.error("[CartService] Error getting/creating cart", error);
    return null;
  }
}

/**
 * Add item to cart
 */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
  unitPrice: number,
  patientInfo?: {
    patientId?: string;
    firstName?: string;
    lastName?: string;
  },
  shippingAddressId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const cart = await getOrCreateCart(userId);
    if (!cart) {
      return { success: false, error: "Failed to get cart" };
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    const { error } = await supabase.from("cart_lines").insert({
      cart_id: cart.id,
      product_id: productId,
      quantity,
      unit_price: unitPrice,
      patient_id: patientInfo?.patientId || null,
      patient_first_name: patientInfo?.firstName || null,
      patient_last_name: patientInfo?.lastName || null,
      shipping_address_id: shippingAddressId || null,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      logger.error("[CartService] Failed to add to cart", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[CartService] Error adding to cart", error);
    return { success: false, error: "Failed to add to cart" };
  }
}

/**
 * Update cart line quantity
 */
export async function updateCartLineQuantity(
  lineId: string,
  quantity: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("cart_lines")
      .update({ quantity })
      .eq("id", lineId);

    if (error) {
      logger.error("[CartService] Failed to update cart line", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[CartService] Error updating cart line", error);
    return { success: false, error: "Failed to update quantity" };
  }
}

/**
 * Remove item from cart
 */
export async function removeFromCart(
  lineId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from("cart_lines")
      .delete()
      .eq("id", lineId);

    if (error) {
      logger.error("[CartService] Failed to remove from cart", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    logger.error("[CartService] Error removing from cart", error);
    return { success: false, error: "Failed to remove item" };
  }
}

/**
 * Clear all items from cart
 */
export async function clearCart(userId: string): Promise<boolean> {
  try {
    const cart = await getOrCreateCart(userId);
    if (!cart) return false;

    const { error } = await supabase
      .from("cart_lines")
      .delete()
      .eq("cart_id", cart.id);

    if (error) {
      logger.error("[CartService] Failed to clear cart", error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error("[CartService] Error clearing cart", error);
    return false;
  }
}

/**
 * Get cart item count
 */
export async function getCartCount(userId: string): Promise<number> {
  try {
    const { data: cart } = await supabase
      .from("cart")
      .select("id")
      .eq("doctor_id", userId)
      .maybeSingle();

    if (!cart) return 0;

    const { count, error } = await supabase
      .from("cart_lines")
      .select("*", { count: "exact", head: true })
      .eq("cart_id", cart.id)
      .gte("expires_at", new Date().toISOString());

    if (error) {
      logger.error("[CartService] Failed to get cart count", error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    logger.error("[CartService] Error getting cart count", error);
    return 0;
  }
}
