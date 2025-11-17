/**
 * Treatment plan types for typed inserts
 */
import type { Database } from '@/integrations/supabase/types';

export type TreatmentPlanInsert = Database['public']['Tables']['treatment_plans']['Insert'];
export type TreatmentPlanGoalInsert = Database['public']['Tables']['treatment_plan_goals']['Insert'];
export type TreatmentPlanUpdateInsert = Database['public']['Tables']['treatment_plan_updates']['Insert'];
