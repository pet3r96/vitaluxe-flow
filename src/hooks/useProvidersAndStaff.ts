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

      console.info('[useProvidersAndStaff] Fetching providers and staff for practice:', practiceId);

      // Fetch providers via edge function
      const { data: providersData, error: provError } = await supabase.functions.invoke('list-providers', {
        body: { practice_id: practiceId }
      });

      if (provError) throw provError;
      const providers = providersData?.providers || [];

      // Fetch staff via edge function
      const { data: staffData, error: staffError } = await supabase.functions.invoke('list-staff', {
        body: { practice_id: practiceId }
      });

      if (staffError) throw staffError;
      const staff = staffData?.staff || [];

      // Combine and standardize
      const combined: ProviderOrStaff[] = [
        ...providers.map((p: any) => ({
          id: p.id,
          user_id: p.user_id,
          full_name: getProviderDisplayName(p),
          type: 'provider' as const,
          profiles: p.profiles,
          first_name: p.first_name,
          last_name: p.last_name,
          specialty: p.specialty,
        })),
        ...staff.map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          full_name: s.profiles?.full_name || s.profiles?.name || s.name || 'Staff Member',
          type: 'staff' as const,
          profiles: s.profiles,
        }))
      ];

      // Sort alphabetically by full_name
      combined.sort((a, b) => a.full_name.localeCompare(b.full_name));

      console.info('[useProvidersAndStaff] ✅ Combined list loaded:', {
        providers: providers.length,
        staff: staff.length,
        total: combined.length,
        sample: combined.slice(0, 3).map(item => `${item.full_name} (${item.type})`)
      });

      return combined;
    },
    enabled: !!practiceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
