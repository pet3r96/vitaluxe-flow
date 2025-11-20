import { supabase } from "@/integrations/supabase/client";
import { toJsonSafe } from "@/types/vault/jsonHelpers";
import type { 
  TypedVaultRecord, 
  MedicationRecordData,
  ConditionRecordData,
  AllergyRecordData,
  VitalRecordData,
  ImmunizationRecordData,
  SurgeryRecordData,
  PharmacyRecordData,
  EmergencyContactRecordData,
  DocumentRecordData,
  NoteRecordData
} from "@/types/vault/records";

/**
 * Type-safe vault query builder
 * Wraps Supabase queries with proper typing for patient_medical_vault records
 */

// Helper to fetch practice_id for a patient account
async function getPracticeId(patientAccountId: string): Promise<string> {
  const { data, error } = await supabase
    .from("patient_accounts")
    .select("practice_id")
    .eq("id", patientAccountId)
    .single();
  
  if (error || !data?.practice_id) {
    throw new Error(`Could not fetch practice_id for patient ${patientAccountId}`);
  }
  
  return data.practice_id;
}

export class VaultQueryBuilder {
  static async getMedications(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "medication")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getConditions(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "condition")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getAllergies(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "allergy")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getVitals(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "vital")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getImmunizations(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "immunization")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getSurgeries(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "surgery")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getPharmacies(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "pharmacy")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getEmergencyContacts(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "emergency_contact")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getDocuments(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "document")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  static async getNotes(patientAccountId: string): Promise<TypedVaultRecord[]> {
    const { data, error } = await supabase
      .from("patient_medical_vault")
      .select("*")
      .eq("patient_account_id", patientAccountId)
      .eq("record_type", "note")
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    return (data || []) as TypedVaultRecord[];
  }

  // Insert methods with typed record_data
  static async insertMedication(
    patientAccountId: string,
    data: MedicationRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "medication",
        title: data.medication_name || "Medication",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertCondition(
    patientAccountId: string,
    data: ConditionRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "condition",
        title: data.condition_name || "Condition",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertAllergy(
    patientAccountId: string,
    data: AllergyRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "allergy",
        title: data.allergen_name || "Allergy",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertVital(
    patientAccountId: string,
    data: VitalRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "vital",
        title: data.vital_type || "Vital Sign",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertImmunization(
    patientAccountId: string,
    data: ImmunizationRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "immunization",
        title: data.vaccine || data.vaccine_name || "Immunization",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertSurgery(
    patientAccountId: string,
    data: SurgeryRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "surgery",
        title: data.procedure || data.surgery_type || "Surgery",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertPharmacy(
    patientAccountId: string,
    data: PharmacyRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "pharmacy",
        title: data.pharmacy_name || data.name || "Pharmacy",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertEmergencyContact(
    patientAccountId: string,
    data: EmergencyContactRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "emergency_contact",
        title: data.name || "Emergency Contact",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertDocument(
    patientAccountId: string,
    data: DocumentRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "document",
        title: data.document_name || "Document",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  static async insertNote(
    patientAccountId: string,
    data: NoteRecordData
  ): Promise<TypedVaultRecord> {
    const practiceId = await getPracticeId(patientAccountId);
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .insert({
        patient_account_id: patientAccountId,
        patient_id: patientAccountId,
        practice_id: practiceId,
        record_type: "note",
        title: "Clinical Note",
        record_data: toJsonSafe(data),
      } as any)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  // Update method
  static async updateRecord(
    recordId: string,
    recordType: TypedVaultRecord['record_type'],
    data: any
  ): Promise<TypedVaultRecord> {
    const { data: result, error } = await supabase
      .from("patient_medical_vault")
      .update({
        record_data: toJsonSafe(data),
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("record_type", recordType)
      .select()
      .single();
    
    if (error) throw error;
    return result as TypedVaultRecord;
  }

  // Delete method
  static async deleteRecord(recordId: string): Promise<void> {
    const { error } = await supabase
      .from("patient_medical_vault")
      .delete()
      .eq("id", recordId);
    
    if (error) throw error;
  }
}
