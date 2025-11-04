import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TreatmentPlan {
  id: string;
  patient_account_id: string;
  plan_title: string;
  diagnosis_condition?: string;
  treatment_protocols: string;
  responsible_provider_id?: string;
  responsible_provider_name?: string;
  target_completion_date?: string;
  actual_completion_date?: string;
  status: 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  notes?: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string;
  last_updated_by_user_id?: string;
  last_updated_by_name?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  is_locked: boolean;
  locked_at?: string;
  locked_by_user_id?: string;
  locked_by_name?: string;
}

export interface TreatmentPlanGoal {
  id: string;
  treatment_plan_id: string;
  goal_description: string;
  goal_order: number;
  status: 'ongoing' | 'achieved' | 'modified' | 'abandoned';
  is_specific?: boolean;
  is_measurable?: boolean;
  is_achievable?: boolean;
  is_relevant?: boolean;
  is_time_bound?: boolean;
  date_achieved?: string;
  achievement_notes?: string;
  date_modified?: string;
  modification_reason?: string;
  previous_description?: string;
  created_by_user_id: string;
  created_by_name: string;
  last_updated_by_user_id?: string;
  last_updated_by_name?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface TreatmentPlanUpdate {
  id: string;
  treatment_plan_id: string;
  update_type: 'progress_note' | 'status_change' | 'goal_update' | 'treatment_completed' | 'complication' | 'patient_feedback' | 'provider_note';
  update_content: string;
  previous_status?: string;
  new_status?: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string;
  created_at: string;
  related_appointment_id?: string;
}

export interface TreatmentPlanAttachment {
  id: string;
  treatment_plan_id: string;
  attachment_type: 'before_photo' | 'after_photo' | 'progress_photo' | 'consent_form' | 'treatment_protocol' | 'lab_result' | 'other_document';
  storage_path: string;
  file_name: string;
  mime_type?: string;
  file_size?: number;
  description?: string;
  taken_date?: string;
  uploaded_by_user_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
  is_active: boolean;
}

// Fetch all treatment plans for a patient
export function useTreatmentPlans(patientAccountId?: string) {
  return useQuery({
    queryKey: ['treatment-plans', patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      
      const { data, error } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('patient_account_id', patientAccountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as TreatmentPlan[];
    },
    enabled: !!patientAccountId,
  });
}

// Fetch single treatment plan with goals and updates
export function useTreatmentPlan(planId?: string) {
  return useQuery({
    queryKey: ['treatment-plan', planId],
    queryFn: async () => {
      if (!planId) return null;

      const [planResult, goalsResult, updatesResult, attachmentsResult] = await Promise.all([
        supabase.from('treatment_plans').select('*').eq('id', planId).single(),
        supabase.from('treatment_plan_goals').select('*').eq('treatment_plan_id', planId).eq('is_active', true).order('goal_order'),
        supabase.from('treatment_plan_updates').select('*').eq('treatment_plan_id', planId).order('created_at', { ascending: false }),
        supabase.from('treatment_plan_attachments').select('*').eq('treatment_plan_id', planId).eq('is_active', true).order('uploaded_at', { ascending: false }),
      ]);

      if (planResult.error) throw planResult.error;

      return {
        plan: planResult.data as TreatmentPlan,
        goals: (goalsResult.data || []) as TreatmentPlanGoal[],
        updates: (updatesResult.data || []) as TreatmentPlanUpdate[],
        attachments: (attachmentsResult.data || []) as TreatmentPlanAttachment[],
      };
    },
    enabled: !!planId,
  });
}

// Create new treatment plan
export function useCreateTreatmentPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      plan: Partial<TreatmentPlan>;
      goals: Array<{ description: string; smartFlags?: Partial<TreatmentPlanGoal> }>;
    }) => {
      // Insert plan
      // Normalize optional provider fields (empty string -> null)
      const planToInsert = {
        ...data.plan,
        responsible_provider_id:
          (data.plan.responsible_provider_id as any) === ''
            ? null
            : data.plan.responsible_provider_id,
        responsible_provider_name:
          (data.plan.responsible_provider_name as any) === ''
            ? null
            : data.plan.responsible_provider_name,
      } as Partial<TreatmentPlan>;

      const { data: planData, error: planError } = await supabase
        .from('treatment_plans')
        .insert([planToInsert] as any)
        .select()
        .single();

      if (planError) throw planError;

      // Insert goals
      if (data.goals.length > 0) {
        const goalsToInsert = data.goals.map((goal, index) => ({
          treatment_plan_id: planData.id,
          goal_description: goal.description,
          goal_order: index,
          is_specific: goal.smartFlags?.is_specific || false,
          is_measurable: goal.smartFlags?.is_measurable || false,
          is_achievable: goal.smartFlags?.is_achievable || false,
          is_relevant: goal.smartFlags?.is_relevant || false,
          is_time_bound: goal.smartFlags?.is_time_bound || false,
          created_by_user_id: data.plan.created_by_user_id,
          created_by_name: data.plan.created_by_name,
        }));

        const { error: goalsError } = await supabase
          .from('treatment_plan_goals')
          .insert(goalsToInsert);

        if (goalsError) throw goalsError;
      }

      // Add creation update
      await supabase.from('treatment_plan_updates').insert({
        treatment_plan_id: planData.id,
        update_type: 'progress_note',
        update_content: 'Treatment plan created',
        created_by_user_id: data.plan.created_by_user_id,
        created_by_role: data.plan.created_by_role,
        created_by_name: data.plan.created_by_name,
      });

      return planData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans', variables.plan.patient_account_id] });
      toast.success("Treatment plan created successfully");
    },
    onError: (error) => {
      console.error('Error creating treatment plan:', error);
      toast.error("Failed to create treatment plan");
    },
  });
}

// Update treatment plan
export function useUpdateTreatmentPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { planId: string; updates: Partial<TreatmentPlan> }) => {
      // Normalize optional provider fields (empty string -> null)
      const updates = {
        ...data.updates,
        responsible_provider_id:
          (data.updates.responsible_provider_id as any) === ''
            ? null
            : data.updates.responsible_provider_id,
        responsible_provider_name:
          (data.updates.responsible_provider_name as any) === ''
            ? null
            : data.updates.responsible_provider_name,
      } as Partial<TreatmentPlan>;

      const { data: result, error } = await supabase
        .from('treatment_plans')
        .update(updates)
        .eq('id', data.planId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', data.id] });
      toast.success("Treatment plan updated successfully");
    },
    onError: (error) => {
      console.error('Error updating treatment plan:', error);
      toast.error("Failed to update treatment plan");
    },
  });
}

// Soft delete treatment plan
export function useDeleteTreatmentPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from('treatment_plans')
        .update({ is_active: false })
        .eq('id', planId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plans'] });
      toast.success("Treatment plan deleted successfully");
    },
    onError: (error) => {
      console.error('Error deleting treatment plan:', error);
      toast.error("Failed to delete treatment plan");
    },
  });
}

// Add goal to plan
export function useAddGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<TreatmentPlanGoal>) => {
      const { data: result, error } = await supabase
        .from('treatment_plan_goals')
        .insert([data] as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', data.treatment_plan_id] });
      toast.success("Goal added successfully");
    },
    onError: (error) => {
      console.error('Error adding goal:', error);
      toast.error("Failed to add goal");
    },
  });
}

// Update goal
export function useUpdateGoal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { goalId: string; updates: Partial<TreatmentPlanGoal> }) => {
      const { data: result, error } = await supabase
        .from('treatment_plan_goals')
        .update(data.updates)
        .eq('id', data.goalId)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', data.treatment_plan_id] });
      toast.success("Goal updated successfully");
    },
    onError: (error) => {
      console.error('Error updating goal:', error);
      toast.error("Failed to update goal");
    },
  });
}

// Add plan update/progress note
export function useAddPlanUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<TreatmentPlanUpdate>) => {
      const { data: result, error } = await supabase
        .from('treatment_plan_updates')
        .insert([data] as any)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', data.treatment_plan_id] });
      toast.success("Update added successfully");
    },
    onError: (error) => {
      console.error('Error adding update:', error);
      toast.error("Failed to add update");
    },
  });
}

// Lock/Unlock plan
export function useLockPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { planId: string; lock: boolean; userId: string; userName: string }) => {
      const updates: Partial<TreatmentPlan> = data.lock
        ? {
            is_locked: true,
            locked_at: new Date().toISOString(),
            locked_by_user_id: data.userId,
            locked_by_name: data.userName,
          }
        : {
            is_locked: false,
            locked_at: undefined,
            locked_by_user_id: undefined,
            locked_by_name: undefined,
          };

      const { error } = await supabase
        .from('treatment_plans')
        .update(updates)
        .eq('id', data.planId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', variables.planId] });
      toast.success(variables.lock ? "Plan locked successfully" : "Plan unlocked successfully");
    },
    onError: (error) => {
      console.error('Error locking/unlocking plan:', error);
      toast.error("Failed to update plan lock status");
    },
  });
}

// Upload attachment
export function useUploadAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      file: File;
      planId: string;
      attachmentType: TreatmentPlanAttachment['attachment_type'];
      description?: string;
      takenDate?: string;
      userId: string;
      userName: string;
    }) => {
      // Upload file to storage
      const fileExt = data.file.name.split('.').pop();
      const filePath = `treatment-plans/${data.planId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('patient-documents')
        .upload(filePath, data.file);

      if (uploadError) throw uploadError;

      // Insert attachment record
      const { data: result, error: dbError } = await supabase
        .from('treatment_plan_attachments')
        .insert({
          treatment_plan_id: data.planId,
          attachment_type: data.attachmentType,
          storage_path: filePath,
          file_name: data.file.name,
          mime_type: data.file.type,
          file_size: data.file.size,
          description: data.description,
          taken_date: data.takenDate,
          uploaded_by_user_id: data.userId,
          uploaded_by_name: data.userName,
        })
        .select()
        .single();

      if (dbError) throw dbError;
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', data.treatment_plan_id] });
      toast.success("File uploaded successfully");
    },
    onError: (error) => {
      console.error('Error uploading attachment:', error);
      toast.error("Failed to upload file");
    },
  });
}

// Delete attachment
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { attachmentId: string; storagePath: string; planId: string }) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('patient-documents')
        .remove([data.storagePath]);

      if (storageError) console.error('Storage delete error:', storageError);

      // Soft delete from database
      const { error: dbError } = await supabase
        .from('treatment_plan_attachments')
        .update({ is_active: false })
        .eq('id', data.attachmentId);

      if (dbError) throw dbError;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['treatment-plan', variables.planId] });
      toast.success("Attachment deleted successfully");
    },
    onError: (error) => {
      console.error('Error deleting attachment:', error);
      toast.error("Failed to delete attachment");
    },
  });
}
