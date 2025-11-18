/**
 * Product Service
 * Handles fetching products with role-based visibility and RLS filtering
 */

import { supabase } from "@/integrations/supabase/client";
import type { ProductQueryParams } from "@/types/domain/products";
import { logger } from "@/lib/logger";

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
    try {
      // Use cached edge function for product visibility
      const { data: cachedData, error: fnError } = await supabase.functions.invoke(
        'get-visible-products',
        { body: { effectiveUserId } }
      );

      if (fnError) {
        logger.warn('Cached product visibility failed, falling back to direct RPC', fnError);
        // Fallback to direct RPC
        const { data: visibleProductsData } = await supabase.rpc(
          "get_visible_products_for_effective_user",
          { p_effective_user_id: effectiveUserId }
        );
        const visibleProductIds = visibleProductsData?.map((p: any) => p.id) || [];
        if (visibleProductIds.length > 0) {
          query = query.in("id", visibleProductIds);
        }
      } else {
        const visibleProductIds = cachedData?.visibleProducts?.map((p: any) => p.id) || [];
        if (visibleProductIds.length > 0) {
          query = query.in("id", visibleProductIds);
        } else {
          logger.warn('No visible product IDs from cached function, relying on RLS');
        }
      }
    } catch (error) {
      logger.warn('Product visibility fetch error, falling back to RLS', error);
    }
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}
