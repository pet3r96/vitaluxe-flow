/**
 * Patients Hook
 * React Query hook for fetching patient accounts
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchPatients } from '@/services/patients/patientService';

export function usePatients() {
  const { effectiveRole, effectivePracticeId } = useAuth();

  return useQuery({
    queryKey: ["patients", effectiveRole, effectivePracticeId],
    queryFn: () => fetchPatients({ effectiveRole, effectivePracticeId }),
    staleTime: 300000, // 5 minutes - patient data changes infrequently
  });
}
