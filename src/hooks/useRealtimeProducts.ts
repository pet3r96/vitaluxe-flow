/**
 * Real-time Products Hook
 * Automatically subscribes to product changes and invalidates cache
 */

import { useRealtimeQuery } from "@/hooks/useRealtimeQuery";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProducts } from "@/services/products/productService";

export function useRealtimeProducts() {
  const { effectiveUserId, effectiveRole, effectivePracticeId, isImpersonating } = useAuth();

  return useRealtimeQuery(
    ["products", effectiveUserId, effectiveRole],
    () => fetchProducts({ effectiveUserId, effectiveRole, effectivePracticeId, isImpersonating }),
    { 
      staleTime: 60000, // 1 minute - products are semi-static
      refetchOnWindowFocus: true,
    }
  );
}
