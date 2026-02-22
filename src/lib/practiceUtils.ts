import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/**
 * Fetches practice details directly from profiles table
 * Avoids heavy joins and RLS issues
 */
export async function getPracticeDetails(practiceId: string | null) {
  if (!practiceId) {
    logger.info("No practice ID provided");
    return null;
  }

  logger.info("Fetching practice details", { practiceId });

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      company,
      address_street,
      address_suite,
      address_city,
      address_state,
      address_zip,
      phone
    `)
    .eq('id', practiceId)
    .maybeSingle();

  if (error) {
    logger.error("Error fetching practice", error, { practiceId });
    return null;
  }

  if (!data) {
    logger.warn("Practice not found", { practiceId });
    return null;
  }

  logger.info("Practice found", { practiceId, name: data.name || data.company });
  return data;
}

/**
 * Formats practice address for display
 */
export function formatPracticeAddress(practice: {
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
} | null): string {
  if (!practice) return '';
  
  const parts = [
    practice.address_street,
    practice.address_city,
    practice.address_state,
    practice.address_zip
  ].filter(Boolean);
  
  return parts.join(', ');
}
