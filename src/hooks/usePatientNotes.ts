import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PatientNote {
  id: string;
  patient_account_id: string;
  note_content: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string;
  last_edited_by_user_id: string | null;
  last_edited_by_name: string | null;
  share_with_patient: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientNoteInput {
  patient_account_id: string;
  note_content: string;
  created_by_user_id: string;
  created_by_role: string;
  created_by_name: string;
  share_with_patient: boolean;
}

export interface UpdatePatientNoteInput {
  id: string;
  note_content: string;
  share_with_patient: boolean;
  last_edited_by_user_id: string;
  last_edited_by_name: string;
}

// Fetch all notes for a patient (practice view)
export function usePatientNotes(patientAccountId: string | undefined) {
  return useQuery({
    queryKey: ['patient-notes', patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from('patient_notes' as any)
        .select('*')
        .eq('patient_account_id', patientAccountId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching patient notes:', error);
        throw error;
      }
      
      return data as unknown as PatientNote[];
    },
    enabled: !!patientAccountId,
  });
}

// Fetch shared notes only (for patient view)
export function useSharedPatientNotes(patientAccountId: string | undefined) {
  return useQuery({
    queryKey: ['patient-shared-notes', patientAccountId],
    queryFn: async () => {
      if (!patientAccountId) return [];
      const { data, error } = await supabase
        .from('patient_notes' as any)
        .select('*')
        .eq('patient_account_id', patientAccountId)
        .eq('is_active', true)
        .eq('share_with_patient', true)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching shared patient notes:', error);
        throw error;
      }
      
      return data as unknown as PatientNote[];
    },
    enabled: !!patientAccountId,
  });
}

// Create note mutation
export function useCreatePatientNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (noteData: CreatePatientNoteInput) => {
      const { data, error } = await supabase
        .from('patient_notes' as any)
        .insert(noteData as any)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating patient note:', error);
        throw error;
      }
      
      return data as unknown as PatientNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', data.patient_account_id] });
      if (data.share_with_patient) {
        queryClient.invalidateQueries({ queryKey: ['patient-shared-notes', data.patient_account_id] });
      }
      toast.success('Note created successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to create note: ${error.message}`);
    },
  });
}

// Update note mutation
export function useUpdatePatientNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, note_content, share_with_patient, last_edited_by_user_id, last_edited_by_name }: UpdatePatientNoteInput) => {
      const { data, error } = await supabase
        .from('patient_notes' as any)
        .update({
          note_content,
          share_with_patient,
          last_edited_by_user_id,
          last_edited_by_name,
        } as any)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating patient note:', error);
        throw error;
      }
      
      return data as unknown as PatientNote;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', data.patient_account_id] });
      queryClient.invalidateQueries({ queryKey: ['patient-shared-notes', data.patient_account_id] });
      toast.success('Note updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });
}

// Soft delete note mutation
export function useDeletePatientNote() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, patientAccountId }: { id: string; patientAccountId: string }) => {
      const { error } = await supabase
        .from('patient_notes' as any)
        .update({ is_active: false } as any)
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting patient note:', error);
        throw error;
      }
      
      return { id, patientAccountId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['patient-notes', data.patientAccountId] });
      queryClient.invalidateQueries({ queryKey: ['patient-shared-notes', data.patientAccountId] });
      toast.success('Note deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });
}
