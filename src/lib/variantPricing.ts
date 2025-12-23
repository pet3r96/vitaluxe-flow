/**
 * Variant Pricing Utilities
 * Centralized logic for determining correct variant prices based on user role/tier
 */

import type { ProductVariant } from "@/types/domain/productVariant";

export type PriceTier = 'topline' | 'downline' | 'retail';

/**
 * Get the appropriate price for a variant based on the user's price tier
 * - topline: topline_price (fallback to base_price)
 * - downline: downline_price (fallback to retail_price, then base_price)
 * - retail: retail_price (fallback to base_price) - default for practices
 */
export function getVariantPriceByTier(
  variant: ProductVariant | null | undefined, 
  tier: PriceTier
): number | null {
  if (!variant) return null;
  
  switch (tier) {
    case 'topline':
      return variant.topline_price ?? variant.base_price;
    case 'downline':
      return variant.downline_price ?? variant.retail_price ?? variant.base_price;
    case 'retail':
    default:
      return variant.retail_price ?? variant.base_price;
  }
}

/**
 * Determine price tier based on rep linkage
 * @param linkedRepRole - The role of the rep linked to the practice ('topline' | 'downline' | null)
 * @returns The price tier to use
 */
export function determinePriceTierFromRepRole(linkedRepRole: string | null): PriceTier {
  if (linkedRepRole === 'topline') return 'topline';
  if (linkedRepRole === 'downline') return 'retail'; // Downline practices pay retail
  return 'retail'; // Default to retail for direct practices
}
