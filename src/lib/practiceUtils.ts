import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches practice details directly from profiles table
 * Avoids heavy joins and RLS issues
 */
export async function getPracticeDetails(practiceId: string | null) {
  if (!practiceId) {
    console.log('[getPracticeDetails] No practice ID provided');
    return null;
  }

  console.log('[getPracticeDetails] Fetching details for practice:', practiceId);

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      name,
      company,
      address_street,
      address_city,
      address_state,
      address_zip,
      phone
    `)
    .eq('id', practiceId)
    .maybeSingle();

  if (error) {
    console.error('[getPracticeDetails] Error fetching practice:', error);
    return null;
  }

  if (!data) {
    console.warn('[getPracticeDetails] Practice not found:', practiceId);
    return null;
  }

  console.log('[getPracticeDetails] Practice found:', data.name || data.company);
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
