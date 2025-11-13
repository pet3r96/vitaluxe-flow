import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Shipping Service
 * Handles shipping calculations and address management
 */

export interface ShippingAddress {
  id?: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
}

export interface ShippingRate {
  carrier: string;
  service: string;
  rate: number;
  estimatedDays: number;
}

/**
 * Calculate shipping cost
 */
export async function calculateShipping(
  cartId: string,
  addressId: string
): Promise<{ cost: number; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "calculate-shipping",
      {
        body: { cartId, addressId },
      }
    );

    if (error) {
      logger.error("[ShippingService] Failed to calculate shipping", error);
      return { cost: 0, error: error.message };
    }

    return { cost: data.cost };
  } catch (error) {
    logger.error("[ShippingService] Error calculating shipping", error);
    return { cost: 0, error: "Failed to calculate shipping" };
  }
}

/**
 * Get available shipping rates
 */
export async function getShippingRates(
  cartId: string,
  addressId: string
): Promise<ShippingRate[]> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "get-shipping-rates",
      {
        body: { cartId, addressId },
      }
    );

    if (error) {
      logger.error("[ShippingService] Failed to get shipping rates", error);
      return [];
    }

    return data.rates || [];
  } catch (error) {
    logger.error("[ShippingService] Error getting shipping rates", error);
    return [];
  }
}

/**
 * Validate shipping address
 */
export async function validateAddress(
  address: ShippingAddress
): Promise<{ valid: boolean; error?: string; suggestions?: ShippingAddress[] }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "google-validate-address",
      {
        body: { address },
      }
    );

    if (error) {
      logger.error("[ShippingService] Address validation failed", error);
      return { valid: false, error: error.message };
    }

    return {
      valid: data.valid,
      suggestions: data.suggestions,
    };
  } catch (error) {
    logger.error("[ShippingService] Error validating address", error);
    return { valid: false, error: "Failed to validate address" };
  }
}

/**
 * Save shipping address
 */
export async function saveShippingAddress(
  practiceId: string,
  address: ShippingAddress
): Promise<{ success: boolean; addressId?: string; error?: string }> {
  try {
    const { data, error } = await supabase
      .from("shipping_addresses")
      .insert({
        practice_id: practiceId,
        street: address.street,
        city: address.city,
        state: address.state,
        zip_code: address.zipCode,
        country: address.country || "US",
      })
      .select("id")
      .single();

    if (error) {
      logger.error("[ShippingService] Failed to save address", error);
      return { success: false, error: error.message };
    }

    return { success: true, addressId: data.id };
  } catch (error) {
    logger.error("[ShippingService] Error saving address", error);
    return { success: false, error: "Failed to save address" };
  }
}

/**
 * Get shipping addresses for practice
 */
export async function getShippingAddresses(
  practiceId: string
): Promise<ShippingAddress[]> {
  try {
    const { data, error } = await supabase
      .from("shipping_addresses")
      .select("*")
      .eq("practice_id", practiceId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[ShippingService] Failed to get addresses", error);
      return [];
    }

    return data.map((addr) => ({
      id: addr.id,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      zipCode: addr.zip_code,
      country: addr.country,
    }));
  } catch (error) {
    logger.error("[ShippingService] Error getting addresses", error);
    return [];
  }
}

/**
 * Generate shipping label
 */
export async function generateShippingLabel(
  orderId: string
): Promise<{ success: boolean; labelUrl?: string; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(
      "generate-shipping-label",
      {
        body: { orderId },
      }
    );

    if (error) {
      logger.error("[ShippingService] Failed to generate label", error);
      return { success: false, error: error.message };
    }

    return { success: true, labelUrl: data.labelUrl };
  } catch (error) {
    logger.error("[ShippingService] Error generating label", error);
    return { success: false, error: "Failed to generate shipping label" };
  }
}
