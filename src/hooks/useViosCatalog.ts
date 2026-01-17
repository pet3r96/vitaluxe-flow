import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface ViosCatalogProduct {
  id: string;
  med_id: string;
  product_name: string;
  form: string | null;
  strength: string | null;
  units: string | null;
  package: string | null;
  schedule: string | null;
}

export function useViosCatalogSearch(searchTerm: string) {
  return useQuery({
    queryKey: ["vios-catalog-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm || searchTerm.length < 2) {
        return [];
      }

      logger.info("[useViosCatalogSearch] Searching VIOS catalog", { searchTerm });

      // Search by med_id if it looks like a number, otherwise search by product name
      const isNumericSearch = /^\d+$/.test(searchTerm);
      
      let query = supabase
        .from("vios_product_catalog")
        .select("*")
        .limit(50);

      if (isNumericSearch) {
        // Exact or prefix match on med_id
        query = query.ilike("med_id", `${searchTerm}%`);
      } else {
        // Case-insensitive search on product name
        query = query.ilike("product_name", `%${searchTerm}%`);
      }

      const { data, error } = await query.order("product_name");

      if (error) {
        logger.error("[useViosCatalogSearch] Error searching VIOS catalog", error);
        throw error;
      }

      return (data || []) as ViosCatalogProduct[];
    },
    enabled: searchTerm.length >= 2,
    staleTime: 60000,
  });
}

export function useViosCatalogByMedId(medId: string | null | undefined) {
  return useQuery({
    queryKey: ["vios-catalog-by-medid", medId],
    queryFn: async () => {
      if (!medId) return null;

      const { data, error } = await supabase
        .from("vios_product_catalog")
        .select("*")
        .eq("med_id", medId)
        .maybeSingle();

      if (error) {
        logger.error("[useViosCatalogByMedId] Error fetching VIOS product", error);
        throw error;
      }

      return data as ViosCatalogProduct | null;
    },
    enabled: !!medId,
    staleTime: 300000,
  });
}

export function useViosCatalogCount() {
  return useQuery({
    queryKey: ["vios-catalog-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vios_product_catalog")
        .select("*", { count: "exact", head: true });

      if (error) {
        logger.error("[useViosCatalogCount] Error counting catalog", error);
        throw error;
      }

      return count || 0;
    },
    staleTime: 300000,
  });
}
