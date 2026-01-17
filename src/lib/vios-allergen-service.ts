import { supabase } from "@/integrations/supabase/client";
import type { AutocompleteOption } from "@/components/ui/autocomplete-input";
import { logger } from "@/lib/logger";

/**
 * Extended autocomplete option with VIOS code
 */
export interface ViosAllergenOption extends AutocompleteOption {
  viosCode: number;
}

/**
 * Search for allergens in the VIOS allergies lookup table
 * Returns options compatible with AutocompleteInput
 */
export async function searchViosAllergens(query: string): Promise<ViosAllergenOption[]> {
  if (query.length < 2) return [];

  try {
    const { data, error } = await supabase
      .from("vios_allergies")
      .select("vios_code, name")
      .ilike("name", `%${query}%`)
      .eq("is_active", true)
      .order("name")
      .limit(15);

    if (error) {
      logger.error("Error searching VIOS allergens", error);
      return [];
    }

    return (data || []).map(item => ({
      value: item.name,
      label: item.name,
      code: String(item.vios_code),
      viosCode: item.vios_code,
    }));
  } catch (err) {
    logger.error("Exception searching VIOS allergens", err);
    return [];
  }
}

/**
 * Get a single allergen by VIOS code
 */
export async function getViosAllergenByCode(viosCode: number): Promise<{ name: string; viosCode: number } | null> {
  try {
    const { data, error } = await supabase
      .from("vios_allergies")
      .select("vios_code, name")
      .eq("vios_code", viosCode)
      .eq("is_active", true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      name: data.name,
      viosCode: data.vios_code,
    };
  } catch (err) {
    logger.error("Exception getting VIOS allergen by code", err);
    return null;
  }
}

/**
 * Get allergen by name - useful for looking up VIOS code for existing allergies
 */
export async function getViosAllergenByName(name: string): Promise<{ name: string; viosCode: number } | null> {
  try {
    // Try exact match first (case-insensitive)
    const { data, error } = await supabase
      .from("vios_allergies")
      .select("vios_code, name")
      .ilike("name", name)
      .eq("is_active", true)
      .limit(1)
      .single();

    if (!error && data) {
      return {
        name: data.name,
        viosCode: data.vios_code,
      };
    }

    // Try fuzzy match if exact match fails
    const { data: fuzzyData } = await supabase
      .from("vios_allergies")
      .select("vios_code, name")
      .ilike("name", `%${name}%`)
      .eq("is_active", true)
      .limit(1);

    if (fuzzyData && fuzzyData.length > 0) {
      return {
        name: fuzzyData[0].name,
        viosCode: fuzzyData[0].vios_code,
      };
    }

    return null;
  } catch (err) {
    logger.error("Exception getting VIOS allergen by name", err);
    return null;
  }
}
