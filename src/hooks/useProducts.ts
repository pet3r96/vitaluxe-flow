/**
 * Products Hook
 * React Query hook for fetching products
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProducts } from '@/services/products/productService';

export function useProducts() {
  const { effectiveUserId, effectiveRole, effectivePracticeId, isImpersonating } = useAuth();

  return useQuery({
    queryKey: ["products", effectiveUserId, effectiveRole],
    queryFn: () => fetchProducts({ effectiveUserId, effectiveRole, effectivePracticeId, isImpersonating }),
    staleTime: 600000, // 10 minutes - products are relatively static
  });
}
