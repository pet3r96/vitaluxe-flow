// Document types for provider and patient documents
// Note: provider_documents accessed via RPC functions, not direct table

export interface ProviderDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_size: number;
  is_hidden?: boolean;
  notes?: string;
  patient_id?: string;
  practice_id?: string;
  share_with_practice?: boolean;
  source?: string;
  uploaded_at?: string;
  uploaded_by?: string;
  url?: string;
  document_id?: string;
  practice_name?: string;
  uploaded_by_name?: string;
  assigned_patient_id?: string;
  assigned_patient_ids?: string[];
  assigned_patient_names?: string[];
  is_internal?: boolean;
  practice?: {
    id: string;
    name: string;
  };
  uploaded_by_profile?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface DocumentFilter {
  source?: "practice" | "patient" | string;
  document_type?: string;
  search?: string;
}
