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
  // Fields for selects
  label?: string;
  subLabel?: string;
  value?: string;
  npi?: string;
  email?: string;
  prescriber_name?: string;
  dea?: string;
  name?: string;
}

export const useProvidersAndStaff = (practiceId: string | null | undefined) => {
  return useQuery({
    queryKey: ['providers-and-staff', practiceId],
    queryFn: async () => {
      if (!practiceId) return [];

      console.info('[useProvidersAndStaff] Fetching unified providers/staff for practice:', practiceId);

      // Step 1: Fetch provider records
      const { data: providerRecords, error: providerError } = await supabase
        .from('providers')
        .select('id, user_id, practice_id, role_type, can_order, active')
        .eq('practice_id', practiceId)
        .eq('active', true);

      if (providerError) throw providerError;
      if (!providerRecords || providerRecords.length === 0) {
        console.info('[useProvidersAndStaff] No providers/staff found');
        return [];
      }

      // Step 2: Fetch profiles for all user_ids
      const userIds = providerRecords.map(p => p.user_id);
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, name, full_name, prescriber_name, email, phone, npi, dea, license_number')
        .in('id', userIds);

      if (profileError) {
        console.error('[useProvidersAndStaff] Profile fetch error:', profileError);
        // Continue with empty profiles rather than failing
      }

      // Step 3: Merge provider records with profiles
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      const combined: ProviderOrStaff[] = providerRecords.map((p: any) => {
        const profile = profileMap.get(p.user_id);
        
        // Build display name with fallbacks
        const displayName = profile?.full_name 
          || profile?.prescriber_name 
          || profile?.name 
          || profile?.email?.split('@')[0] 
          || 'Provider';

        return {
          id: p.id,
          user_id: p.user_id,
          full_name: displayName,
          name: displayName,
          type: p.role_type === 'provider' ? 'provider' as const : 'staff' as const,
          profiles: profile,
          specialty: profile?.npi ? 'Medical Provider' : undefined,
          // Add fields for selects
          label: profile?.prescriber_name || profile?.full_name || displayName,
          subLabel: profile?.npi ? `NPI: ${profile.npi}` : 'NPI: N/A',
          value: p.id,
          npi: profile?.npi,
          email: profile?.email,
          prescriber_name: profile?.prescriber_name || profile?.full_name || displayName,
          dea: profile?.dea,
        };
      });

      // Sort alphabetically by full_name
      combined.sort((a, b) => a.full_name.localeCompare(b.full_name));

      const providerCount = combined.filter(p => p.type === 'provider').length;
      const staffCount = combined.filter(p => p.type === 'staff').length;
      
      console.info('[useProvidersAndStaff] ✅ Combined list loaded:', {
        providers: providerCount,
        staff: staffCount,
        total: combined.length,
        sample: combined.slice(0, 3).map(item => `${item.full_name} (${item.type}) - NPI: ${item.npi || 'N/A'}`)
      });

      return combined;
    },
    enabled: !!practiceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Hook for providers only (excludes staff)
export const usePracticeProviders = (practiceId: string | null | undefined) => {
  const { data: allPersonnel, ...rest } = useProvidersAndStaff(practiceId);
  
  const providers = allPersonnel?.filter(p => p.type === 'provider') || [];
  
  console.info('[usePracticeProviders] Filtered to providers only:', providers.length);
  
  return {
    data: providers,
    ...rest
  };
};
