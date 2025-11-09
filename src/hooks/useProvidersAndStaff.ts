import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProviderDisplayName } from "@/utils/providerNameUtils";

export interface ProviderOrStaff {
  id: string;
  user_id: string;
  full_name: string;
  type: 'provider' | 'staff';
  profiles?: any;
  first_name?: string;
  last_name?: string;
  specialty?: string;
}

export const useProvidersAndStaff = (practiceId: string | null | undefined) => {
  return useQuery({
    queryKey: ['providers-and-staff', practiceId],
    queryFn: async () => {
      if (!practiceId) return [];

      console.info('[useProvidersAndStaff] Fetching unified providers/staff for practice:', practiceId);

      // Fetch all personnel (providers + staff) from unified providers table
      const { data, error } = await supabase
        .from('providers')
        .select(`
          id,
          user_id,
          practice_id,
          role_type,
          can_order,
          active,
          profiles!providers_user_id_fkey(
            id,
            name,
            full_name,
            prescriber_name,
            email,
            phone,
            npi
          )
        `)
        .eq('practice_id', practiceId)
        .eq('active', true);

      if (error) throw error;
      const personnel = data || [];

      // Transform to standardized format
      const combined: ProviderOrStaff[] = personnel.map((p: any) => ({
        id: p.id,
        user_id: p.user_id,
        full_name: getProviderDisplayName(p),
        type: p.role_type === 'provider' ? 'provider' as const : 'staff' as const,
        profiles: p.profiles,
        specialty: p.profiles?.npi ? 'Medical Provider' : undefined,
      }));

      // Sort alphabetically by full_name
      combined.sort((a, b) => a.full_name.localeCompare(b.full_name));

      const providerCount = combined.filter(p => p.type === 'provider').length;
      const staffCount = combined.filter(p => p.type === 'staff').length;
      
      console.info('[useProvidersAndStaff] ✅ Combined list loaded:', {
        providers: providerCount,
        staff: staffCount,
        total: combined.length,
        sample: combined.slice(0, 3).map(item => `${item.full_name} (${item.type})`)
      });

      return combined;
    },
    enabled: !!practiceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
