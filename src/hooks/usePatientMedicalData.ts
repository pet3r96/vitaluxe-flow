/**
 * Patient Medical Data Hook
 * React Query hook for fetching patient medical records
 */

import { useQuery } from '@tanstack/react-query';
import { fetchPatientMedicalData } from '@/services/patients/patientMedicalDataService';

export function usePatientMedicalData(patientId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["patient-medical-data", patientId],
    queryFn: () => fetchPatientMedicalData(patientId),
    enabled,
    staleTime: 300000, // 5 minutes - medical data changes infrequently
  });
}
