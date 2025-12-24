/**
 * Variant Pricing Utilities
 * Simplified 2-tier pricing model: base_price (our cost) and retail_price (practice price)
 */

import type { ProductVariant } from "@/types/domain/productVariant";

export type PriceTier = 'base' | 'retail';

/**
 * Get the appropriate price for a variant based on the user's price tier
 * - base: base_price (internal/our cost)
 * - retail: retail_price (practice/medspa price) - default
 */
export function getVariantPriceByTier(
  variant: ProductVariant | null | undefined, 
  tier: PriceTier
): number | null {
  if (!variant) return null;
  
  switch (tier) {
    case 'base':
      return variant.base_price;
    case 'retail':
    default:
      return variant.retail_price ?? variant.base_price;
  }
}

/**
 * Get retail price for practices (default pricing)
 */
export function getRetailPrice(variant: ProductVariant | null | undefined): number | null {
  return getVariantPriceByTier(variant, 'retail');
}

/**
 * Get base price (internal cost)
 */
export function getBasePrice(variant: ProductVariant | null | undefined): number | null {
  return getVariantPriceByTier(variant, 'base');
}
