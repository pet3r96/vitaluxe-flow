/**
 * Patient Account Hook
 * Centralized hook for fetching patient account data with impersonation support
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface UsePatientAccountOptions {
  includeProfile?: boolean;
  includePractice?: boolean;
  staleTime?: number;
}

interface PatientAccountData {
  id: string;
  practice_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth?: string | null;
  gender_at_birth?: string | null;
  address_street?: string | null;
  address_city?: string | null;
  address_state?: string | null;
  address_zip?: string | null;
  practice?: {
    name: string | null;
    address_street: string | null;
    address_city: string | null;
    address_state: string | null;
    address_zip: string | null;
  };
}

export function usePatientAccount(options: UsePatientAccountOptions = {}) {
  const { effectiveUserId } = useAuth();
  const {
    includeProfile = false,
    includePractice = false,
    staleTime = 300000, // 5 minutes default
  } = options;

  return useQuery({
    queryKey: ["patient-account", effectiveUserId, includeProfile, includePractice],
    queryFn: async (): Promise<PatientAccountData | null> => {
      if (!effectiveUserId) throw new Error("Not authenticated");
      
      logger.info("Fetching patient account", { effectiveUserId, includeProfile, includePractice });
      
      // Check for active impersonation session with graceful fallback
      let targetUserId = effectiveUserId;
      try {
        const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
        if (impersonationData?.session?.impersonated_user_id) {
          targetUserId = impersonationData.session.impersonated_user_id;
          logger.info("Using impersonated user ID", { targetUserId });
        }
      } catch (e) {
        logger.warn("get-active-impersonation failed, using effectiveUserId", { effectiveUserId });
      }
      
      // Build select query
      let selectQuery = "id, practice_id, first_name, last_name, email, phone";
      
      if (includeProfile) {
        selectQuery += ", date_of_birth, gender_at_birth, address_street, address_city, address_state, address_zip";
      }
      
      // Get patient account
      const { data, error } = await supabase
        .from("patient_accounts")
        .select(selectQuery)
        .eq("user_id", targetUserId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      // Cast data to the appropriate type (supabase types can be overly strict)
      const patientData = data as any as PatientAccountData;
      
      // If includePractice and we have a practice_id, fetch practice details separately
      if (includePractice && patientData.practice_id) {
        const { data: practiceData, error: practiceError } = await supabase
          .from("profiles")
          .select("name, address_street, address_city, address_state, address_zip")
          .eq("id", patientData.practice_id)
          .single();
        
        if (!practiceError && practiceData) {
          logger.info("Practice data loaded", { practiceName: practiceData.name });
          return {
            ...patientData,
            practice: practiceData as any
          };
        }
      }
      
      logger.info("Patient account loaded", { patientId: patientData.id });
      return patientData;
    },
    enabled: !!effectiveUserId,
    staleTime,
  });
}
