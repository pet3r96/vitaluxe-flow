import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { GoogleAddressAutocomplete, AddressValue } from "@/components/ui/google-address-autocomplete";
import { AutocompleteInput } from "@/components/ui/autocomplete-input";
import { searchMedications, searchAllergens, searchConditions, searchSurgeries, searchVaccines } from "@/lib/medical-api-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, X } from "lucide-react";
import { logMedicalVaultChange } from "@/hooks/useAuditLogs";
import { logger } from "@/lib/logger";
import { usePagePerformance } from "@/hooks/usePagePerformance";

const intakeSchema = z.object({
  date_of_birth: z.string()
    .min(1, "Date of birth is required")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Please enter a complete date")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date < new Date();
    }, "Date of birth must be a valid past date"),
  gender_at_birth: z.string().min(1, "Gender is required"),
  phone: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => val.length === 10, "Phone must be exactly 10 digits"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(5, "Zip code is required"),
  emergency_contact_name: z.string().optional().or(z.literal("")),
  emergency_contact_relationship: z.string().optional().or(z.literal("")),
  emergency_contact_phone: z.string().optional().or(z.literal("")),
  emergency_contact_email: z.string().email().optional().or(z.literal("")),
  height: z.string()
    .optional()
    .refine((val) => {
      if (!val || val === "") return true;
      const heightRegex = /^[3-8]-([0-9]|1[01])$/;
      return heightRegex.test(val);
    }, "Height must be in format like 5-5, 5-11, or 6-0 (feet-inches)"),
  weight: z.string().optional(),
  blood_type: z.string().optional(),
  pharmacy_name: z.string().optional().or(z.literal("")),
  pharmacy_address: z.string().optional().or(z.literal("")),
  pharmacy_city: z.string().optional().or(z.literal("")),
  pharmacy_state: z.string().optional().or(z.literal("")),
  pharmacy_zip: z.string().optional().or(z.literal("")),
  pharmacy_phone: z.string().optional().or(z.literal("")),
});

type IntakeFormData = z.infer<typeof intakeSchema>;

interface MedicationEntry {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  customFrequency?: string;
}

interface AllergyEntry {
  id: string;
  name: string;
  reaction: string;
  severity: string;
}

interface ConditionEntry {
  id: string;
  name: string;
  diagnosed_date: string;
  status: string;
}

interface SurgeryEntry {
  id: string;
  type: string;
  date: string;
  notes: string;
}

interface ImmunizationEntry {
  id: string;
  vaccine_name: string;
  date_administered: string;
}

interface PatientIntakeFormProps {
  targetPatientAccountId?: string; // When provided, use this instead of effectiveUserId (for practice users)
}

// Type guard helpers
function isMedicationRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'medication' }> {
  return record.record_type === 'medication';
}

function isConditionRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'condition' }> {
  return record.record_type === 'condition';
}

function isAllergyRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'allergy' }> {
  return record.record_type === 'allergy';
}

function isVitalRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'vital_sign' }> {
  return record.record_type === 'vital_sign';
}

function isImmunizationRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'immunization' }> {
  return record.record_type === 'immunization';
}

function isSurgeryRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'procedure' }> {
  return record.record_type === 'procedure';
}

function isPharmacyRecord(record: import("@/types/vault/records").TypedVaultRecord): record is Extract<import("@/types/vault/records").TypedVaultRecord, { record_type: 'pharmacy' }> {
  return record.record_type === 'pharmacy';
}

export default function PatientIntakeForm({ targetPatientAccountId }: PatientIntakeFormProps = {}) {
  usePagePerformance('PatientIntakeForm');
  const navigate = useNavigate();
  const { effectiveUserId, effectiveRole } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [medications, setMedications] = useState<MedicationEntry[]>([{ id: crypto.randomUUID(), name: "", dosage: "", frequency: "" }]);
  const [allergies, setAllergies] = useState<AllergyEntry[]>([{ id: crypto.randomUUID(), name: "", reaction: "", severity: "" }]);
  const [conditions, setConditions] = useState<ConditionEntry[]>([{ id: crypto.randomUUID(), name: "", diagnosed_date: "", status: "active" }]);
  const [surgeries, setSurgeries] = useState<SurgeryEntry[]>([{ id: crypto.randomUUID(), type: "", date: "", notes: "" }]);
  const [immunizations, setImmunizations] = useState<ImmunizationEntry[]>([{ id: crypto.randomUUID(), vaccine_name: "", date_administered: "" }]);
  
  // "None" checkboxes for medical history sections
  const [hasNoMedications, setHasNoMedications] = useState(false);
  const [hasNoAllergies, setHasNoAllergies] = useState(false);
  const [hasNoConditions, setHasNoConditions] = useState(false);
  const [hasNoSurgeries, setHasNoSurgeries] = useState(false);
  const [hasNoImmunizations, setHasNoImmunizations] = useState(false);
  const [hasNoPharmacy, setHasNoPharmacy] = useState(false);
  const [hasNoEmergencyContact, setHasNoEmergencyContact] = useState(false);
  const [showMedicalHistoryWarning, setShowMedicalHistoryWarning] = useState(false);

  // Fetch existing patient account data
  const { data: patientAccount, isLoading } = useQuery({
    queryKey: ['patient-account', targetPatientAccountId || effectiveUserId],
    queryFn: async () => {
      // Practice mode: Fetch by patient_account_id directly
      if (targetPatientAccountId) {
        const { data, error } = await supabase
          .from('patient_accounts')
          .select('*')
          .eq('id', targetPatientAccountId)
          .single();
        
        if (error) throw error;
        return data;
      }
      
      // Patient mode: Fetch by user_id (original behavior)
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!(targetPatientAccountId || effectiveUserId),
  });

  // Fetch existing medical vault data (may be added by practice)
  const { data: existingMedications = [] } = useQuery({
    queryKey: ['existing-medications', patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from('patient_medical_vault')
        .select('*')
        .eq('patient_account_id', patientAccount.id)
        .eq('record_type', 'medication');
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const { data: existingAllergies = [] } = useQuery({
    queryKey: ['existing-allergies', patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from('patient_medical_vault')
        .select('*')
        .eq('patient_account_id', patientAccount.id)
        .eq('record_type', 'allergy');
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const { data: existingConditions = [] } = useQuery({
    queryKey: ['existing-conditions', patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from('patient_medical_vault')
        .select('*')
        .eq('patient_account_id', patientAccount.id)
        .eq('record_type', 'condition');
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const { data: existingSurgeries = [] } = useQuery({
    queryKey: ['existing-surgeries', patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from('patient_medical_vault')
        .select('*')
        .eq('patient_account_id', patientAccount.id)
        .eq('record_type', 'procedure');
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const { data: existingImmunizations = [] } = useQuery({
    queryKey: ['existing-immunizations', patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from('patient_medical_vault')
        .select('*')
        .eq('patient_account_id', patientAccount.id)
        .eq('record_type', 'immunization');
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const form = useForm<IntakeFormData>({
    resolver: zodResolver(intakeSchema),
    defaultValues: {
      date_of_birth: "",
      gender_at_birth: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zip_code: "",
      emergency_contact_name: "",
      emergency_contact_relationship: "",
      emergency_contact_phone: "",
      emergency_contact_email: "",
      height: "",
      weight: "",
      blood_type: "",
      pharmacy_name: "",
      pharmacy_address: "",
      pharmacy_city: "",
      pharmacy_state: "",
      pharmacy_zip: "",
      pharmacy_phone: "",
    },
  });

  // Pre-fill form with existing data
  useEffect(() => {
    if (patientAccount) {
      logger.info('[PatientIntakeForm] Pre-populating form with patient data', {
        date_of_birth: patientAccount.date_of_birth,
        gender_at_birth: patientAccount.gender_at_birth,
        phone: patientAccount.phone,
        address: patientAccount.address,
        city: patientAccount.city,
        state: patientAccount.state,
        zip_code: patientAccount.zip_code,
        intake_completed_at: patientAccount.intake_completed_at,
      });
      
      form.reset({
        date_of_birth: patientAccount.date_of_birth || "",
        gender_at_birth: patientAccount.gender_at_birth || "",
        phone: patientAccount.phone || "",
        address: patientAccount.address || "",
        city: patientAccount.city || "",
        state: patientAccount.state || "",
        zip_code: patientAccount.zip_code || "",
        emergency_contact_name: patientAccount.emergency_contact_name || "",
        emergency_contact_relationship: "",
        emergency_contact_phone: patientAccount.emergency_contact_phone || "",
        emergency_contact_email: "",
        height: "",
        weight: "",
        blood_type: "",
        pharmacy_name: "",
        pharmacy_address: "",
        pharmacy_city: "",
        pharmacy_state: "",
        pharmacy_zip: "",
        pharmacy_phone: "",
      });
      
      logger.info('[PatientIntakeForm] Form reset complete. Current form values', {
        date_of_birth: form.getValues('date_of_birth'),
        address: form.getValues('address'),
        city: form.getValues('city'),
        state: form.getValues('state'),
        zip_code: form.getValues('zip_code'),
      });
    }
  }, [patientAccount, form]);

  // Pre-populate medical vault data added by practice
  useEffect(() => {
    if (existingMedications && existingMedications.length > 0) {
      const medList = existingMedications.map((med: any) => ({
        id: crypto.randomUUID(),
        name: (med as any).medication_name || '',
        dosage: (med as any).dosage || '',
        frequency: (med as any).frequency || '',
      }));
      setMedications(medList);
      setHasNoMedications(false);
    }
  }, [existingMedications]);

  useEffect(() => {
    if (existingAllergies && existingAllergies.length > 0) {
      const allergyList = existingAllergies.map((allergy: any) => ({
        id: crypto.randomUUID(),
        name: (allergy as any).allergen_name || '',
        reaction: (allergy as any).reaction_type || '',
        severity: (allergy as any).severity || '',
      }));
      setAllergies(allergyList);
      setHasNoAllergies(false);
    }
  }, [existingAllergies]);

  useEffect(() => {
    if (existingConditions && existingConditions.length > 0) {
      const conditionList = existingConditions.map((condition: any) => ({
        id: crypto.randomUUID(),
        name: (condition as any).condition_name || '',
        diagnosed_date: (condition as any).date_diagnosed || '',
        status: 'active', // Default status for intake form
      }));
      setConditions(conditionList);
      setHasNoConditions(false);
    }
  }, [existingConditions]);

  useEffect(() => {
    if (existingSurgeries && existingSurgeries.length > 0) {
      const surgeryList = existingSurgeries.map((surgery: any) => ({
        id: crypto.randomUUID(),
        type: (surgery as any).surgery_type || '',
        date: (surgery as any).surgery_date || '',
        notes: (surgery as any).notes || '',
      }));
      setSurgeries(surgeryList);
      setHasNoSurgeries(false);
    }
  }, [existingSurgeries]);

  useEffect(() => {
    if (existingImmunizations && existingImmunizations.length > 0) {
      logger.info('[Immunizations] Loading existing data', { count: existingImmunizations?.length });
      const immunizationList = existingImmunizations.map((imm: any) => {
        // Handle date formatting - ensure it's in YYYY-MM-DD format
        let dateFormatted = '';
        if ((imm as any).date_administered && (imm as any).date_administered !== 'null' && (imm as any).date_administered !== 'undefined') {
          // Split on 'T' to remove any time component and ensure YYYY-MM-DD format
          const dateStr = String((imm as any).date_administered).split('T')[0];
          // Only set if it's a valid date string
          if (dateStr && dateStr !== 'null' && dateStr !== 'undefined' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            dateFormatted = dateStr;
          }
        }
        
        return {
          id: crypto.randomUUID(),
          vaccine_name: (imm as any).vaccine_name || '',
          date_administered: dateFormatted,
        };
      });
      logger.info('[Immunizations] Mapped list with formatted dates', { count: immunizationList.length });
      setImmunizations(immunizationList);
      setHasNoImmunizations(false);
    } else {
      logger.info('[Immunizations] No existing data found', { existingImmunizations });
    }
  }, [existingImmunizations]);

  const handleAddressChange = (value: AddressValue) => {
    form.setValue("address", value.street || "");
    form.setValue("city", value.city || "");
    form.setValue("state", value.state || "");
    form.setValue("zip_code", value.zip || "");
  };

  const handlePharmacyAddressChange = (value: AddressValue) => {
    form.setValue("pharmacy_address", value.street || "");
    form.setValue("pharmacy_city", value.city || "");
    form.setValue("pharmacy_state", value.state || "");
    form.setValue("pharmacy_zip", value.zip || "");
  };

  const onSubmit = async (data: IntakeFormData) => {
    if (!patientAccount?.id) {
      toast.error("Patient account not found");
      return;
    }

    // Check if medical history is complete
    const hasMedicalData = 
      medications.some(m => m.name) || hasNoMedications ||
      allergies.some(a => a.name) || hasNoAllergies ||
      conditions.some(c => c.name) || hasNoConditions ||
      surgeries.some(s => s.type) || hasNoSurgeries ||
      immunizations.some(i => i.vaccine_name) || hasNoImmunizations;

    if (!hasMedicalData) {
      setShowMedicalHistoryWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      // Update patient_accounts
      const { error: accountError } = await supabase
        .from('patient_accounts')
        .update({
          date_of_birth: data.date_of_birth,
          gender_at_birth: data.gender_at_birth,
          phone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zip_code: data.zip_code,
          emergency_contact_name: data.emergency_contact_name,
          emergency_contact_phone: data.emergency_contact_phone,
          intake_completed_at: new Date().toISOString(),
        })
        .eq('id', patientAccount.id);

      if (accountError) throw accountError;

      // Log demographics update
      const auditRole = targetPatientAccountId ? (effectiveRole || 'staff') : 'patient';
      await logMedicalVaultChange({
        patientAccountId: patientAccount.id,
        actionType: 'updated',
        entityType: 'demographics',
        changedByUserId: effectiveUserId,
        changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
        newData: { 
          date_of_birth: data.date_of_birth, 
          gender_at_birth: data.gender_at_birth,
          phone: data.phone,
          address: `${data.address}, ${data.city}, ${data.state} ${data.zip_code}`,
        },
        changeSummary: `Updated patient demographics`,
      });

      // Insert vitals if provided
      if (data.height || data.weight) {
        logger.info('[Vitals] Saving height/weight', { height: data.height, weight: data.weight });
        
        let heightInches = null;
        if (data.height) {
          const [feet, inches] = data.height.split('-').map(Number);
          heightInches = (feet * 12) + inches;
        }
        
        // Insert height record to patient_medical_vault
        if (heightInches) {
          const { error: heightError } = await supabase.from('patient_medical_vault').insert({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'vital_sign',
            title: 'Height',
            record_data: {
              vital_type: 'height',
              height: heightInches,
              height_unit: 'in',
              date_recorded: new Date().toISOString(),
              added_by_user_id: effectiveUserId,
              added_by_role: auditRole,
            }
          } as any);
          
          if (heightError) {
            logger.error('Height insert error', heightError);
            throw new Error(`Failed to save height: ${heightError.message}`);
          }
          logger.info('Saved height');
        }
        
        // Insert weight record to patient_medical_vault
        if (data.weight) {
          const { error: weightError } = await supabase.from('patient_medical_vault').insert({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'vital_sign',
            title: 'Weight',
            record_data: {
              vital_type: 'weight',
              weight: parseFloat(data.weight),
              weight_unit: 'lbs',
              date_recorded: new Date().toISOString(),
              added_by_user_id: effectiveUserId,
              added_by_role: auditRole,
            }
          } as any);
          
          if (weightError) {
            logger.error('Weight insert error', weightError);
            throw new Error(`Failed to save weight: ${weightError.message}`);
          }
          logger.info('Saved weight');
        }
      }

      // Update medical vault with blood type
      if (data.blood_type) {
        // Check if vault record exists
        const { data: existingVault } = await supabase
          .from('patient_medical_vault')
          .select('id')
          .eq('patient_id', patientAccount.id)
          .maybeSingle();

        if (existingVault) {
          // Update existing record
          await supabase
            .from('patient_medical_vault')
            .update({ blood_type: data.blood_type })
            .eq('id', existingVault.id);
        } else {
          // Insert new record - use type assertion due to generated types
          await supabase
            .from('patient_medical_vault')
            .insert({
              patient_id: patientAccount.id,
              blood_type: data.blood_type,
            } as any);
        }
      }

      // Insert medications (only if not marked as "none")
      if (medications.length > 0 && !hasNoMedications) {
        const incompleteCount = medications.filter(m => !m.name || !m.dosage || !m.frequency).length;
        if (incompleteCount > 0) {
          logger.warn(`${incompleteCount} medication(s) skipped due to missing required fields`, { incompleteCount });
        }
        
        const medEntries = medications
          .filter(m => m.name.trim())
          .map(med => ({
            patient_account_id: patientAccount.id,
            medication_name: med.name.trim(),
            dosage: med.dosage?.trim() || null,
            frequency: med.frequency === 'other' ? (med.customFrequency || med.frequency) : (med.frequency || null),
            start_date: new Date().toISOString(),
            is_active: true,
            added_by_user_id: effectiveUserId,
            added_by_role: auditRole,
          }));
        
        // 🔍 DIAGNOSTIC LOG: Before saving medications
        logger.info(`[PatientIntakeForm] Saving ${medEntries.length} medications`, 
          medEntries.map(m => ({ name: m.medication_name, dosage: m.dosage, frequency: m.frequency }))
        );
        
        if (medEntries.length > 0) {
          const vaultEntries = medEntries.map(med => ({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'medication',
            title: med.medication_name,
            record_data: med
          }));
          
          const { error: medError } = await supabase
            .from('patient_medical_vault')
            .insert(vaultEntries as any);
          
          if (medError) {
            logger.error('Medication insert error', medError);
            throw new Error(`Failed to save medications: ${medError.message}`);
          }
          
          // Log each medication individually
          for (const med of medEntries) {
            await logMedicalVaultChange({
              patientAccountId: patientAccount.id,
              actionType: 'created',
              entityType: 'medication',
              entityName: med.medication_name,
              changedByUserId: effectiveUserId,
              changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
              newData: med,
              changeSummary: `Added medication: ${med.medication_name} (${med.dosage}, ${med.frequency})`,
            });
          }
          
          logger.info(`Saved ${medEntries.length} medication(s)`, { count: medEntries.length });
        }
      }

      // Insert allergies or NKA record
      if (hasNoAllergies) {
        // Insert NKA (No Known Allergies) record to patient_medical_vault
        const { error: nkaError } = await supabase
          .from('patient_medical_vault')
          .insert({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'allergy',
            title: 'No Known Allergies (NKA)',
            record_data: {
              nka: true,
              is_active: true,
              added_by_user_id: effectiveUserId,
              added_by_role: 'patient',
              date_recorded: new Date().toISOString(),
            }
          } as any);
        
        if (nkaError) {
          logger.error('NKA insert error', nkaError);
          throw new Error(`Failed to save NKA status: ${nkaError.message}`);
        }
        
        // Log NKA creation
        await logMedicalVaultChange({
          patientAccountId: patientAccount.id,
          actionType: 'created',
          entityType: 'allergy',
          entityName: 'No Known Allergies (NKA)',
          changedByUserId: effectiveUserId,
          changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
          newData: { nka: true },
          changeSummary: `Patient indicated: No Known Allergies (NKA)`,
        });
        
        logger.info('Saved NKA status');
      } else if (allergies.length > 0) {
        const incompleteCount = allergies.filter(a => !a.name || !a.reaction).length;
        if (incompleteCount > 0) {
          logger.warn(`${incompleteCount} allergy/allergies skipped due to missing required fields`, { incompleteCount });
        }
        
        const allergyEntries = allergies
          .filter(a => a.name.trim())
          .map(allergy => ({
            patient_account_id: patientAccount.id,
            allergen_name: allergy.name.trim(),
            reaction_type: allergy.reaction?.trim() || null,
            severity: allergy.severity || null,
            date_recorded: new Date().toISOString(),
            is_active: true,
            added_by_user_id: effectiveUserId,
            added_by_role: auditRole,
          }));
        
        // 🔍 DIAGNOSTIC LOG: Before saving allergies
        logger.info(`[PatientIntakeForm] Saving ${allergyEntries.length} allergies`,
          allergyEntries.map(a => ({ name: a.allergen_name, reaction: a.reaction_type }))
        );
        
        if (allergyEntries.length > 0) {
          const vaultEntries = allergyEntries.map(allergy => ({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'allergy',
            title: allergy.allergen_name,
            record_data: allergy
          }));
          
          const { error: allergyError } = await supabase
            .from('patient_medical_vault')
            .insert(vaultEntries as any);
          
          if (allergyError) {
            logger.error('Allergy insert error', allergyError);
            throw new Error(`Failed to save allergies: ${allergyError.message}`);
          }
          
          // Log each allergy individually
          for (const allergy of allergyEntries) {
            await logMedicalVaultChange({
              patientAccountId: patientAccount.id,
              actionType: 'created',
              entityType: 'allergy',
              entityName: allergy.allergen_name,
              changedByUserId: effectiveUserId,
              changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
              newData: allergy,
              changeSummary: `Added allergy: ${allergy.allergen_name} (${allergy.reaction_type}, ${allergy.severity})`,
            });
          }
          
          logger.info(`Saved ${allergyEntries.length} allergy/allergies`, { count: allergyEntries.length });
        }
      }

      // Insert conditions (only if not marked as "none")
      if (conditions.length > 0 && !hasNoConditions) {
        const incompleteCount = conditions.filter(c => !c.name || !c.diagnosed_date).length;
        if (incompleteCount > 0) {
          logger.warn(`${incompleteCount} condition(s) skipped due to missing required fields`, { incompleteCount });
        }
        
        const conditionEntries = conditions
          .filter(c => c.name.trim())
          .map(condition => ({
            patient_account_id: patientAccount.id,
            condition_name: condition.name.trim(),
            date_diagnosed: condition.diagnosed_date 
              ? (condition.diagnosed_date.length === 7 
                  ? condition.diagnosed_date + '-01'
                  : condition.diagnosed_date)
              : null,
            is_active: true,
            added_by_user_id: effectiveUserId,
            added_by_role: auditRole,
          }));
        
        // 🔍 DIAGNOSTIC LOG: Before saving conditions
        logger.info(`[PatientIntakeForm] Saving ${conditionEntries.length} conditions`,
          conditionEntries.map(c => ({ name: c.condition_name, date: c.date_diagnosed }))
        );
        
        if (conditionEntries.length > 0) {
          const vaultEntries = conditionEntries.map(condition => ({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'condition',
            title: condition.condition_name,
            record_data: condition
          }));
          
          const { error: conditionError } = await supabase
            .from('patient_medical_vault')
            .insert(vaultEntries as any);
          
          if (conditionError) {
            logger.error('Condition insert error', conditionError);
            throw new Error(`Failed to save conditions: ${conditionError.message}`);
          }
          
          // Log each condition individually
          for (const condition of conditionEntries) {
            await logMedicalVaultChange({
              patientAccountId: patientAccount.id,
              actionType: 'created',
              entityType: 'condition',
              entityName: condition.condition_name,
              changedByUserId: effectiveUserId,
              changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
              newData: condition,
              changeSummary: `Added condition: ${condition.condition_name} (diagnosed ${condition.date_diagnosed})`,
            });
          }
          
          logger.info(`Saved ${conditionEntries.length} condition(s)`, { count: conditionEntries.length });
        }
      }

      // Insert surgeries (only if not marked as "none")
      if (surgeries.length > 0 && !hasNoSurgeries) {
        const incompleteCount = surgeries.filter(s => !s.type || !s.date).length;
        if (incompleteCount > 0) {
          logger.warn(`${incompleteCount} surgery/surgeries skipped due to missing required fields`, { incompleteCount });
        }
        
        const surgeryEntries = surgeries
          .filter(s => s.type.trim())
          .map(surgery => ({
            patient_account_id: patientAccount.id,
            surgery_type: surgery.type,
            surgery_date: surgery.date 
              ? (surgery.date.length === 7 
                  ? surgery.date + '-01'
                  : surgery.date)
              : null,
            notes: surgery.notes || null,
            added_by_user_id: effectiveUserId,
            added_by_role: auditRole,
          }));
        
        if (surgeryEntries.length > 0) {
          const vaultEntries = surgeryEntries.map(surgery => ({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'procedure',
            title: surgery.surgery_type,
            record_data: surgery
          }));
          
          const { error: surgeryError } = await supabase
            .from('patient_medical_vault')
            .insert(vaultEntries as any);
          
          if (surgeryError) {
            logger.error('Surgery insert error', surgeryError);
            throw new Error(`Failed to save surgeries: ${surgeryError.message}`);
          }
          
          // Log each surgery individually
          for (const surgery of surgeryEntries) {
            await logMedicalVaultChange({
              patientAccountId: patientAccount.id,
              actionType: 'created',
              entityType: 'surgery',
              entityName: surgery.surgery_type,
              changedByUserId: effectiveUserId,
              changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
              newData: surgery,
              changeSummary: `Added surgery: ${surgery.surgery_type} (${surgery.surgery_date})`,
            });
          }
          
          logger.info(`Saved ${surgeryEntries.length} surgery/surgeries`, { count: surgeryEntries.length });
        }
      }

      // Insert immunizations (only if not marked as "none")
      if (immunizations.length > 0 && !hasNoImmunizations) {
        const incompleteCount = immunizations.filter(i => !i.vaccine_name || !i.date_administered).length;
        if (incompleteCount > 0) {
          logger.warn(`${incompleteCount} immunization(s) skipped due to missing required fields`, { incompleteCount });
        }
        
      const immEntries = immunizations
        .filter(i => i.vaccine_name.trim() && i.date_administered)
        .map(imm => ({
          patient_account_id: patientAccount.id,
          vaccine_name: (imm as any).vaccine_name,
          date_administered: imm.date_administered,
          added_by_user_id: effectiveUserId,
          added_by_role: auditRole,
        }));
        
        if (immEntries.length > 0) {
          const vaultEntries = immEntries.map(imm => ({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'immunization',
            title: imm.vaccine_name,
            record_data: imm
          }));
          
          const { error: immError } = await supabase
            .from('patient_medical_vault')
            .insert(vaultEntries as any);
          
          if (immError) {
            logger.error('Immunization insert error', immError);
            throw new Error(`Failed to save immunizations: ${immError.message}`);
          }
          
          // Log each immunization individually
          for (const imm of immEntries) {
            await logMedicalVaultChange({
              patientAccountId: patientAccount.id,
              actionType: 'created',
              entityType: 'immunization',
              entityName: imm.vaccine_name,
              changedByUserId: effectiveUserId,
              changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
              newData: imm,
              changeSummary: `Added immunization: ${imm.vaccine_name} (${imm.date_administered})`,
            });
          }
          
          logger.info(`Saved ${immEntries.length} immunization(s)`, { count: immEntries.length });
        }
      }

      // Insert or update pharmacy using patient_medical_vault
      if (!hasNoPharmacy && data.pharmacy_name && data.pharmacy_name.trim()) {
        const { data: existingPharmacy } = await supabase
          .from('patient_medical_vault')
          .select('id')
          .eq('patient_account_id', patientAccount.id)
          .eq('record_type', 'pharmacy')
          .eq('title', data.pharmacy_name)
          .maybeSingle();

        const pharmacyData = {
          pharmacy_name: data.pharmacy_name,
          address: data.pharmacy_address,
          city: data.pharmacy_city,
          state: data.pharmacy_state,
          zip_code: data.pharmacy_zip,
          phone: data.pharmacy_phone,
          is_preferred: true,
          added_by_user_id: effectiveUserId,
          added_by_role: auditRole,
        };

        if (existingPharmacy) {
          await supabase
            .from('patient_medical_vault')
            .update({
              record_data: pharmacyData
            })
            .eq('id', existingPharmacy.id);
        } else {
          await supabase.from('patient_medical_vault').insert({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'pharmacy',
            title: data.pharmacy_name,
            record_data: pharmacyData
          } as any);
          
          // Log pharmacy creation
          await logMedicalVaultChange({
            patientAccountId: patientAccount.id,
            actionType: 'created',
            entityType: 'pharmacy',
            entityName: data.pharmacy_name,
            changedByUserId: effectiveUserId,
            changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
            newData: { pharmacy_name: data.pharmacy_name, address: data.pharmacy_address },
            changeSummary: `Added preferred pharmacy: ${data.pharmacy_name}`,
          });
        }
        logger.info('Saved pharmacy information');
      } else {
        logger.info('Skipped pharmacy (user indicated no pharmacy or no data provided)');
      }

      // Insert or update emergency contact using patient_medical_vault
      if (!hasNoEmergencyContact && data.emergency_contact_name && data.emergency_contact_name.trim()) {
        const { data: existingContact } = await supabase
          .from('patient_medical_vault')
          .select('id')
          .eq('patient_account_id', patientAccount.id)
          .eq('record_type', 'emergency_contact')
          .maybeSingle();

        const contactData = {
          name: data.emergency_contact_name,
          relationship: data.emergency_contact_relationship,
          phone: data.emergency_contact_phone,
          email: data.emergency_contact_email || null,
          added_by_user_id: effectiveUserId,
          added_by_role: auditRole,
        };

        if (existingContact) {
          await supabase
            .from('patient_medical_vault')
            .update({
              title: data.emergency_contact_name,
              record_data: contactData
            })
            .eq('id', existingContact.id);
        } else {
          await supabase.from('patient_medical_vault').insert({
            patient_account_id: patientAccount.id,
            patient_id: patientAccount.id,
            record_type: 'emergency_contact',
            title: data.emergency_contact_name,
            record_data: contactData
          } as any);
          
          // Log emergency contact creation
          await logMedicalVaultChange({
            patientAccountId: patientAccount.id,
            actionType: 'created',
            entityType: 'emergency_contact',
            entityName: data.emergency_contact_name,
            changedByUserId: effectiveUserId,
            changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
            newData: { name: data.emergency_contact_name, phone: data.emergency_contact_phone },
            changeSummary: `Added emergency contact: ${data.emergency_contact_name}`,
          });
        }
        logger.info('Saved emergency contact information');
      } else {
        logger.info('Skipped emergency contact (user indicated no contact or no data provided)');
      }

      // Log intake completion
      await logMedicalVaultChange({
        patientAccountId: patientAccount.id,
        actionType: 'pre_intake_completed',
        entityType: 'pre_intake_form',
        changedByUserId: effectiveUserId,
        changedByRole: auditRole as 'patient' | 'doctor' | 'staff' | 'provider',
        changeSummary: targetPatientAccountId 
          ? `${effectiveRole} completed pre-intake form on behalf of patient`
          : `Patient completed pre-intake form`,
      });

      toast.success("Intake form completed successfully!");
      
      // Navigate appropriately based on user type
      if (targetPatientAccountId) {
        // Practice mode: Navigate back to patient detail page
        navigate(`/patients/${targetPatientAccountId}`);
      } else {
        // Patient mode: Navigate to medical vault
        navigate('/medical-vault');
      }
    } catch (error) {
      logger.error('Intake submission error', error);
      toast.error("Failed to submit intake form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="patient-container max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="patient-section-header">Patient Intake Form</h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">Complete your medical information to help us provide better care</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
          {/* Personal Demographics */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Personal Information</CardTitle>
              <CardDescription>Basic demographic information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <Input value={patientAccount?.first_name || ""} disabled />
                </FormItem>
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <Input value={patientAccount?.last_name || ""} disabled />
                </FormItem>
              </div>
              
              <FormItem>
                <FormLabel>Email</FormLabel>
                <Input value={patientAccount?.email || ""} disabled />
              </FormItem>

              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date of Birth *</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        max={new Date().toISOString().split('T')[0]}
                      />
                    </FormControl>
                    <FormMessage />
                    <p className="text-sm text-muted-foreground">
                      Please enter your complete date of birth
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gender_at_birth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender at Birth *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={!field.value ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Intersex">Intersex</SelectItem>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number *</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Address</CardTitle>
              <CardDescription>Your residential address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GoogleAddressAutocomplete
                key={`address-${patientAccount?.id}-${patientAccount?.address || 'empty'}`}
                label="Street Address *"
                value={{
                  street: form.watch("address"),
                  city: form.watch("city"),
                  state: form.watch("state"),
                  zip: form.watch("zip_code"),
                  status: "unverified",
                  source: "user_input",
                }}
                onChange={handleAddressChange}
                required
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="zip_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Emergency Contact</CardTitle>
                <CardDescription>Someone we can contact in case of emergency</CardDescription>
              </div>
              <Badge variant={!hasNoEmergencyContact && form.getValues("emergency_contact_name") ? "default" : "secondary"}>
                {hasNoEmergencyContact ? "Skipped" : form.getValues("emergency_contact_name") ? "Added" : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-emergency-contact"
                    checked={hasNoEmergencyContact}
                    onCheckedChange={(checked) => {
                      setHasNoEmergencyContact(checked as boolean);
                      if (checked) {
                        form.setValue("emergency_contact_name", "");
                        form.setValue("emergency_contact_relationship", "");
                        form.setValue("emergency_contact_phone", "");
                        form.setValue("emergency_contact_email", "");
                      }
                    }}
                  />
                  <label htmlFor="no-emergency-contact" className="text-sm text-muted-foreground cursor-pointer">
                    Skip emergency contact / Don't know (uncheck to add)
                  </label>
                </div>
                {hasNoEmergencyContact && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add emergency contact information
                  </p>
                )}
              </div>
              
              {!hasNoEmergencyContact && (
                <>
              <FormField
                control={form.control}
                name="emergency_contact_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Sibling">Sibling</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Friend">Friend</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="emergency_contact_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (Optional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </>
              )}
            </CardContent>
          </Card>

          {/* Vitals */}
          <Card className="patient-card">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Vital Information</CardTitle>
              <CardDescription>Basic health measurements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="height"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Height</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="e.g., 5-5, 5-11, 6-0 (feet-inches)"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (lbs)</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} placeholder="e.g., 150" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="blood_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Blood Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select blood type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                        <SelectItem value="Unknown">Unknown</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Medical History - Medications */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Current Medications</CardTitle>
                <CardDescription>List any medications you're currently taking</CardDescription>
              </div>
              <Badge variant={medications.some(m => m.name) || hasNoMedications ? "default" : "secondary"}>
                {hasNoMedications ? "None" : medications.filter(m => m.name).length > 0 ? 
                  `${medications.filter(m => m.name).length} added` : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-medications"
                    checked={hasNoMedications}
                    onCheckedChange={(checked) => {
                      setHasNoMedications(checked as boolean);
                      if (checked) {
                        setMedications([]);
                      } else {
                        setMedications([{ id: crypto.randomUUID(), name: "", dosage: "", frequency: "" }]);
                      }
                    }}
                  />
                  <label htmlFor="no-medications" className="text-sm text-muted-foreground cursor-pointer">
                    I do not take any medications (uncheck to add)
                  </label>
                </div>
                {hasNoMedications && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add medications
                  </p>
                )}
              </div>
              
              {!hasNoMedications && (
                <>
              {medications.map((med, index) => (
                <div key={med.id} className="space-y-2">
                  <div className="flex flex-col md:flex-row gap-2 items-start">
                    <div className="flex-1 w-full">
                      <AutocompleteInput
                        placeholder="Search medication name"
                        value={med.name}
                        onChange={(value) => {
                          const newMeds = [...medications];
                          newMeds[index].name = value;
                          setMedications(newMeds);
                        }}
                        onSearch={searchMedications}
                      />
                    </div>
                    <Input
                      className="flex-1 w-full"
                      placeholder="e.g., 10mg, 500mcg"
                      value={med.dosage}
                      onChange={(e) => {
                        const newMeds = [...medications];
                        newMeds[index].dosage = e.target.value;
                        setMedications(newMeds);
                      }}
                    />
                    <Select
                      value={med.frequency}
                      onValueChange={(value) => {
                        const newMeds = [...medications];
                        newMeds[index].frequency = value;
                        if (value !== 'Other') {
                          newMeds[index].customFrequency = '';
                        }
                        setMedications(newMeds);
                      }}
                    >
                      <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Once daily">Once daily</SelectItem>
                        <SelectItem value="Twice daily">Twice daily</SelectItem>
                        <SelectItem value="Three times daily">Three times daily</SelectItem>
                        <SelectItem value="As needed">As needed</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setMedications(medications.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {med.frequency === 'Other' && (
                    <Input
                      placeholder="Specify custom frequency (optional)"
                      value={med.customFrequency || ''}
                      onChange={(e) => {
                        const newMeds = [...medications];
                        newMeds[index].customFrequency = e.target.value;
                        setMedications(newMeds);
                      }}
                      className="w-full"
                    />
                  )}
                </div>
              ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMedications([...medications, { id: crypto.randomUUID(), name: "", dosage: "", frequency: "" }])}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Another Medication
                </Button>
              </>
              )}
            </CardContent>
          </Card>

          {/* Allergies */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Allergies</CardTitle>
                <CardDescription>List any known allergies</CardDescription>
              </div>
              <Badge variant={allergies.some(a => a.name) || hasNoAllergies ? "default" : "secondary"}>
                {hasNoAllergies ? "None" : allergies.filter(a => a.name).length > 0 ? 
                  `${allergies.filter(a => a.name).length} added` : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-allergies"
                    checked={hasNoAllergies}
                    onCheckedChange={(checked) => {
                      setHasNoAllergies(checked as boolean);
                      if (checked) {
                        setAllergies([]);
                      } else {
                        setAllergies([{ id: crypto.randomUUID(), name: "", reaction: "", severity: "" }]);
                      }
                    }}
                  />
                  <label htmlFor="no-allergies" className="text-sm text-muted-foreground cursor-pointer">
                    I have no known allergies (uncheck to add)
                  </label>
                </div>
                {hasNoAllergies && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add allergies
                  </p>
                )}
              </div>
              
              {!hasNoAllergies && (
                <>
              {allergies.map((allergy, index) => (
                <div key={allergy.id} className="flex flex-col md:flex-row gap-2 items-start">
                  <div className="flex-1 w-full">
                    <AutocompleteInput
                      placeholder="Search allergen name"
                      value={allergy.name}
                      onChange={(value) => {
                        const newAllergies = [...allergies];
                        newAllergies[index].name = value;
                        setAllergies(newAllergies);
                      }}
                      onSearch={searchAllergens}
                    />
                  </div>
                  <Input
                    className="flex-1 w-full"
                    placeholder="e.g., hives, rash, swelling"
                    value={allergy.reaction}
                    onChange={(e) => {
                      const newAllergies = [...allergies];
                      newAllergies[index].reaction = e.target.value;
                      setAllergies(newAllergies);
                    }}
                  />
                  <Select
                    value={allergy.severity}
                    onValueChange={(value) => {
                      const newAllergies = [...allergies];
                      newAllergies[index].severity = value;
                      setAllergies(newAllergies);
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mild">Mild</SelectItem>
                      <SelectItem value="Moderate">Moderate</SelectItem>
                      <SelectItem value="Severe">Severe</SelectItem>
                      <SelectItem value="Life-threatening">Life-threatening</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setAllergies(allergies.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAllergies([...allergies, { id: crypto.randomUUID(), name: "", reaction: "", severity: "" }])}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Another Allergy
                </Button>
              </>
              )}
            </CardContent>
          </Card>

          {/* Medical Conditions */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Medical Conditions</CardTitle>
                <CardDescription>List any current or past medical conditions</CardDescription>
              </div>
              <Badge variant={conditions.some(c => c.name) || hasNoConditions ? "default" : "secondary"}>
                {hasNoConditions ? "None" : conditions.filter(c => c.name).length > 0 ? 
                  `${conditions.filter(c => c.name).length} added` : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-conditions"
                    checked={hasNoConditions}
                    onCheckedChange={(checked) => {
                      setHasNoConditions(checked as boolean);
                      if (checked) {
                        setConditions([]);
                      } else {
                        setConditions([{ id: crypto.randomUUID(), name: "", diagnosed_date: "", status: "active" }]);
                      }
                    }}
                  />
                  <label htmlFor="no-conditions" className="text-sm text-muted-foreground cursor-pointer">
                    I have no medical conditions (uncheck to add)
                  </label>
                </div>
                {hasNoConditions && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add conditions
                  </p>
                )}
              </div>
              
              {!hasNoConditions && (
                <>
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex flex-col md:flex-row gap-2 items-start">
                  <div className="flex-1 w-full">
                    <AutocompleteInput
                      placeholder="Search condition name"
                      value={condition.name}
                      onChange={(value) => {
                        const newConditions = [...conditions];
                        newConditions[index].name = value;
                        setConditions(newConditions);
                      }}
                      onSearch={searchConditions}
                    />
                  </div>
                  <Input
                    className="flex-1 w-full"
                    type="month"
                    placeholder="MM/YYYY"
                    value={condition.diagnosed_date}
                    onChange={(e) => {
                      const newConditions = [...conditions];
                      newConditions[index].diagnosed_date = e.target.value;
                      setConditions(newConditions);
                    }}
                  />
                  <Select
                    value={condition.status}
                    onValueChange={(value) => {
                      const newConditions = [...conditions];
                      newConditions[index].status = value;
                      setConditions(newConditions);
                    }}
                  >
                    <SelectTrigger className="w-full md:w-[200px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Resolved">Resolved</SelectItem>
                      <SelectItem value="Managed">Managed</SelectItem>
                      <SelectItem value="Chronic">Chronic</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => setConditions(conditions.filter((_, i) => i !== index))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConditions([...conditions, { id: crypto.randomUUID(), name: "", diagnosed_date: "", status: "" }])}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Another Condition
                </Button>
              </>
              )}
            </CardContent>
          </Card>

          {/* Past Surgeries */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Past Surgeries</CardTitle>
                <CardDescription>List any surgical procedures you've had</CardDescription>
              </div>
              <Badge variant={surgeries.some(s => s.type) || hasNoSurgeries ? "default" : "secondary"}>
                {hasNoSurgeries ? "None" : surgeries.filter(s => s.type).length > 0 ? 
                  `${surgeries.filter(s => s.type).length} added` : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-surgeries"
                    checked={hasNoSurgeries}
                    onCheckedChange={(checked) => {
                      setHasNoSurgeries(checked as boolean);
                      if (checked) {
                        setSurgeries([]);
                      } else {
                        setSurgeries([{ id: crypto.randomUUID(), type: "", date: "", notes: "" }]);
                      }
                    }}
                  />
                  <label htmlFor="no-surgeries" className="text-sm text-muted-foreground cursor-pointer">
                    I have not had any surgeries (uncheck to add)
                  </label>
                </div>
                {hasNoSurgeries && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add surgeries
                  </p>
                )}
              </div>
              
              {!hasNoSurgeries && (
                <>
              {surgeries.map((surgery, index) => (
                <div key={surgery.id} className="space-y-2">
                  <div className="flex flex-col md:flex-row gap-2 items-start">
                    <div className="flex-1 w-full">
                      <AutocompleteInput
                        placeholder="Search surgery type"
                        value={surgery.type}
                        onChange={(value) => {
                          const newSurgeries = [...surgeries];
                          newSurgeries[index].type = value;
                          setSurgeries(newSurgeries);
                        }}
                        onSearch={searchSurgeries}
                      />
                    </div>
                    <Input
                      className="flex-1 w-full"
                      type="month"
                      placeholder="MM/YYYY"
                      value={surgery.date}
                      onChange={(e) => {
                        const newSurgeries = [...surgeries];
                        newSurgeries[index].date = e.target.value;
                        setSurgeries(newSurgeries);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setSurgeries(surgeries.filter((_, i) => i !== index))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Notes (optional)"
                    value={surgery.notes}
                    onChange={(e) => {
                      const newSurgeries = [...surgeries];
                      newSurgeries[index].notes = e.target.value;
                      setSurgeries(newSurgeries);
                    }}
                    className="w-full"
                  />
                </div>
              ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSurgeries([...surgeries, { id: crypto.randomUUID(), type: "", date: "", notes: "" }])}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add Another Surgery
                </Button>
              </>
              )}
            </CardContent>
          </Card>

          {/* Immunizations */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Immunizations</CardTitle>
                <CardDescription>List any recent vaccinations you've received</CardDescription>
              </div>
              <Badge variant={immunizations.some(i => i.vaccine_name) || hasNoImmunizations ? "default" : "secondary"}>
                {hasNoImmunizations ? "None" : immunizations.filter(i => i.vaccine_name).length > 0 ? 
                  `${immunizations.filter(i => i.vaccine_name).length} added` : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-immunizations"
                    checked={hasNoImmunizations}
                    onCheckedChange={(checked) => {
                      setHasNoImmunizations(checked as boolean);
                      if (checked) {
                        setImmunizations([]);
                      } else {
                        setImmunizations([{ id: crypto.randomUUID(), vaccine_name: "", date_administered: "" }]);
                      }
                    }}
                  />
                  <label htmlFor="no-immunizations" className="text-sm text-muted-foreground cursor-pointer">
                    No recent immunizations to report (uncheck to add)
                  </label>
                </div>
                {hasNoImmunizations && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add immunizations
                  </p>
                )}
              </div>
              
              {!hasNoImmunizations && (
                <>
                  {immunizations.map((immunization, index) => {
                    logger.info(`[Immunization ${index}] Rendering`, { vaccine: immunization.vaccine_name, date: immunization.date_administered });
                    return (
                      <div key={immunization.id} className="flex flex-col md:flex-row gap-2 items-start">
                      <div className="flex-1 w-full">
                        <AutocompleteInput
                          placeholder="Search vaccine name"
                          value={immunization.vaccine_name}
                          onChange={(value) => {
                            const newImms = [...immunizations];
                            newImms[index].vaccine_name = value;
                            setImmunizations(newImms);
                          }}
                          onSearch={searchVaccines}
                        />
                      </div>
                      <Input
                        type="date"
                        className="flex-1 w-full"
                        placeholder="MM/DD/YYYY"
                        value={immunization.date_administered || ''}
                        onChange={(e) => {
                          const newImms = [...immunizations];
                          newImms[index].date_administered = e.target.value;
                          setImmunizations(newImms);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setImmunizations(immunizations.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImmunizations([...immunizations, { id: crypto.randomUUID(), vaccine_name: "", date_administered: "" }])}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add Another Immunization
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Pharmacy Information */}
          <Card className="patient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="space-y-1">
                <CardTitle className="text-lg md:text-xl">Preferred Pharmacy</CardTitle>
                <CardDescription>Where you'd like prescriptions sent</CardDescription>
              </div>
              <Badge variant={!hasNoPharmacy && form.getValues("pharmacy_name") ? "default" : "secondary"}>
                {hasNoPharmacy ? "Unknown" : form.getValues("pharmacy_name") ? "Added" : "Not completed"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="no-pharmacy"
                    checked={hasNoPharmacy}
                    onCheckedChange={(checked) => {
                      setHasNoPharmacy(checked as boolean);
                      if (checked) {
                        form.setValue("pharmacy_name", "");
                        form.setValue("pharmacy_address", "");
                        form.setValue("pharmacy_city", "");
                        form.setValue("pharmacy_state", "");
                        form.setValue("pharmacy_zip", "");
                        form.setValue("pharmacy_phone", "");
                      }
                    }}
                  />
                  <label htmlFor="no-pharmacy" className="text-sm text-muted-foreground cursor-pointer">
                    I don't know the pharmacy information (uncheck to add)
                  </label>
                </div>
                {hasNoPharmacy && (
                  <p className="text-xs text-muted-foreground ml-6">
                    ✓ Uncheck this box if you need to add pharmacy information
                  </p>
                )}
              </div>
              
              {!hasNoPharmacy && (
                <>
              <FormField
                control={form.control}
                name="pharmacy_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pharmacy Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., CVS Pharmacy" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <GoogleAddressAutocomplete
                label="Pharmacy Address"
                value={{
                  street: form.watch("pharmacy_address"),
                  city: form.watch("pharmacy_city"),
                  state: form.watch("pharmacy_state"),
                  zip: form.watch("pharmacy_zip"),
                  status: "unverified",
                  source: "user_input",
                }}
                onChange={handlePharmacyAddressChange}
                required={false}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="pharmacy_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Los Angeles" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pharmacy_state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input {...field} maxLength={2} placeholder="e.g., CA" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pharmacy_zip"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zip Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 90210" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="pharmacy_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pharmacy Phone</FormLabel>
                    <FormControl>
                      <PhoneInput
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="(555) 123-4567"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Complete Intake'
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* Medical History Warning Dialog */}
      <AlertDialog open={showMedicalHistoryWarning} onOpenChange={setShowMedicalHistoryWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Complete Medical History?</AlertDialogTitle>
            <AlertDialogDescription>
              You haven't added any medical information (medications, allergies, conditions, surgeries, or immunizations) 
              and haven't marked any sections as "None". 
              <br/><br/>
              Would you like to go back and add this information, or continue without it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go Back and Add Information</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowMedicalHistoryWarning(false);
              setHasNoMedications(true);
              setHasNoAllergies(true);
              setHasNoConditions(true);
              setHasNoSurgeries(true);
              setHasNoImmunizations(true);
              // Re-trigger form submission by calling onSubmit directly
              form.handleSubmit(onSubmit)();
            }}>
              Continue Without Medical History
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
