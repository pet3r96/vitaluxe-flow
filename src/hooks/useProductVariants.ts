import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ProductVariant, ProductVariantFormData } from "@/types/domain/productVariant";

export function useProductVariants(productId: string | undefined | null) {
  return useQuery({
    queryKey: ['product-variants', productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order', { ascending: true });
      
      if (error) {
        logger.error('[useProductVariants] Error fetching variants', error);
        throw error;
      }
      
      return (data || []) as ProductVariant[];
    },
    enabled: !!productId,
    staleTime: 30000,
  });
}

export function useActiveProductVariants(productId: string | undefined | null) {
  return useQuery({
    queryKey: ['product-variants-active', productId],
    queryFn: async () => {
      if (!productId) return [];
      
      const { data, error } = await supabase
        .from('product_variants')
        .select('*')
        .eq('product_id', productId)
        .eq('active', true)
        .order('sort_order', { ascending: true });
      
      if (error) {
        logger.error('[useActiveProductVariants] Error fetching variants', error);
        throw error;
      }
      
      return (data || []) as ProductVariant[];
    },
    enabled: !!productId,
    staleTime: 30000,
  });
}

interface SyncVariantsParams {
  productId: string;
  variants: ProductVariantFormData[];
}

export function useSyncProductVariants() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ productId, variants }: SyncVariantsParams) => {
      logger.info('[useSyncProductVariants] Syncing variants', { productId, count: variants.length });
      
      // Delete variants marked for deletion
      const toDelete = variants.filter(v => v.toDelete && v.id);
      for (const variant of toDelete) {
        const { error } = await supabase
          .from('product_variants')
          .delete()
          .eq('id', variant.id!);
        
        if (error) {
          logger.error('[useSyncProductVariants] Error deleting variant', error);
          throw error;
        }
      }
      
      // Upsert remaining variants
      const toUpsert = variants.filter(v => !v.toDelete);
      
      for (let i = 0; i < toUpsert.length; i++) {
        const variant = toUpsert[i];
        const variantData = {
          product_id: productId,
          dosage_label: variant.dosage_label,
          base_price: parseFloat(variant.base_price) || 0,
          topline_price: variant.topline_price ? parseFloat(variant.topline_price) : null,
          downline_price: variant.downline_price ? parseFloat(variant.downline_price) : null,
          retail_price: variant.retail_price ? parseFloat(variant.retail_price) : null,
          active: variant.active,
          sort_order: i,
          product_code: variant.product_code || null,
          default_sig: variant.default_sig || null,
        };
        
        if (variant.id && !variant.isNew) {
          // Update existing
          const { error } = await supabase
            .from('product_variants')
            .update(variantData)
            .eq('id', variant.id);
          
          if (error) {
            logger.error('[useSyncProductVariants] Error updating variant', error);
            throw error;
          }
        } else {
          // Insert new
          const { error } = await supabase
            .from('product_variants')
            .insert(variantData);
          
          if (error) {
            logger.error('[useSyncProductVariants] Error inserting variant', error);
            throw error;
          }
        }
      }
      
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-variants', variables.productId] });
      queryClient.invalidateQueries({ queryKey: ['product-variants-active', variables.productId] });
    },
  });
}
