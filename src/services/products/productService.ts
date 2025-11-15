/**
 * Product Service
 * Handles fetching products with role-based visibility and RLS filtering
 */

import { supabase } from "@/integrations/supabase/client";
import type { ProductQueryParams } from "@/types/domain/products";

export async function fetchProducts(params: ProductQueryParams) {
  const { effectiveUserId, effectiveRole, effectivePracticeId, isImpersonating } = params;
  
  // Only admin (not impersonating) bypasses product visibility filtering
  const viewingAsAdmin = (effectiveRole === "admin") && !isImpersonating;

  let query = supabase
    .from("products")
    .select(`
      *,
      product_types(id, name),
      product_pharmacies (
        pharmacy:pharmacies (
          id,
          name,
          states_serviced,
          priority_map,
          active
        )
      )
    `)
    .order("created_at", { ascending: false });

  // Apply visibility filtering (only admins not impersonating bypass)
  if (!viewingAsAdmin) {
    const { data: visibleProductsData } = await supabase.rpc(
      "get_visible_products_for_effective_user",
      { p_effective_user_id: effectiveUserId }
    );

    const visibleProductIds = visibleProductsData?.map((p: any) => p.id) || [];
    
    if (visibleProductIds.length > 0) {
      query = query.in("id", visibleProductIds);
    } else {
      // Fallback: rely on RLS to return permitted products for this user/practice
      // Do not early-return empty to avoid false negatives when RPC is misconfigured
      console.warn('[productService] No visible product IDs from RPC, falling back to RLS-only select');
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}
