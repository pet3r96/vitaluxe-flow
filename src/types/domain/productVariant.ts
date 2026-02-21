/**
 * Product Variant Domain Types
 * Centralized type definitions for product variants/dosages
 */

export interface ProductVariant {
  id: string;
  product_id: string;
  dosage_label: string;
  sku?: string | null;
  base_price: number;
  topline_price?: number | null;
  downline_price?: number | null;
  retail_price?: number | null;
  active: boolean;
  sort_order: number;
  product_code?: string | null;
  default_sig?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductVariantFormData {
  id?: string;
  dosage_label: string;
  base_price: string;
  topline_price: string;
  downline_price: string;
  retail_price: string;
  active: boolean;
  product_code: string;
  isNew?: boolean;
  toDelete?: boolean;
}

export function createEmptyVariant(): ProductVariantFormData {
  return {
    dosage_label: '',
    base_price: '',
    topline_price: '',
    downline_price: '',
    retail_price: '',
    active: true,
    product_code: '',
    isNew: true,
  };
}
