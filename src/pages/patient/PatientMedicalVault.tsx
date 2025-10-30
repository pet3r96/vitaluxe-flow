import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, Pill, Heart, Syringe, Scissors, Building2, Phone, Lock, Share2, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { MedicationsSection } from "@/components/medical-vault/MedicationsSection";
import { ConditionsSection } from "@/components/medical-vault/ConditionsSection";
import { AllergiesSection } from "@/components/medical-vault/AllergiesSection";
import { VitalsSection } from "@/components/medical-vault/VitalsSection";
import { ImmunizationsSection } from "@/components/medical-vault/ImmunizationsSection";
import { SurgeriesSection } from "@/components/medical-vault/SurgeriesSection";
import { PharmaciesSection } from "@/components/medical-vault/PharmaciesSection";
import { EmergencyContactsSection } from "@/components/medical-vault/EmergencyContactsSection";

export default function PatientMedicalVault() {
  // Get patient account
  const { data: patientAccount } = useQuery({
    queryKey: ["patient-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all medical data
  const { data: medications } = useQuery({
    queryKey: ["patient-medications", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_medications")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccount?.id,
  });

  const { data: conditions } = useQuery({
    queryKey: ["patient-conditions", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_conditions")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccount?.id,
  });

  const { data: allergies } = useQuery({
    queryKey: ["patient-allergies", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_allergies")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccount?.id,
  });

  const { data: vitals } = useQuery({
    queryKey: ["patient-vitals", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_vitals")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("date_recorded", { ascending: false })
        .limit(1);
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccount?.id,
  });

  const activeAllergies = allergies?.filter(a => a.is_active && !a.nka) || [];
  const activeMedications = medications?.filter(m => m.is_active) || [];
  const activeConditions = conditions?.filter(c => c.is_active) || [];
  const hasNKA = allergies?.some(a => a.nka) || false;

  return (
    <div className="space-y-6 p-6">
      {/* Patient Quick View Dashboard */}
      <Card className="border-2">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">
                {patientAccount?.first_name} {patientAccount?.last_name}
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                Medical Vault - Secure Health Information
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Lock className="h-4 w-4 mr-2" />
                Secure
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Date of Birth</p>
              <p className="font-medium">
                {patientAccount?.date_of_birth 
                  ? format(new Date(patientAccount.date_of_birth), 'MMM dd, yyyy')
                  : 'Not set'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Gender at Birth</p>
              <p className="font-medium">{patientAccount?.gender_at_birth || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Contact</p>
              <p className="font-medium">{patientAccount?.phone || patientAccount?.email || 'Not set'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Primary Provider</p>
              <p className="font-medium">Not assigned</p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Allergies</p>
                </div>
                {hasNKA ? (
                  <Badge variant="outline">NKA (No Known Allergies)</Badge>
                ) : activeAllergies.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {activeAllergies.slice(0, 3).map((allergy) => (
                      <Badge key={allergy.id} variant="destructive">
                        {allergy.allergen_name}
                      </Badge>
                    ))}
                    {activeAllergies.length > 3 && (
                      <Badge variant="outline">+{activeAllergies.length - 3} more</Badge>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Pill className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Active Medications</p>
                </div>
                {activeMedications.length > 0 ? (
                  <div className="space-y-1">
                    {activeMedications.slice(0, 3).map((med) => (
                      <p key={med.id} className="text-sm">{med.medication_name}</p>
                    ))}
                    {activeMedications.length > 3 && (
                      <p className="text-sm text-muted-foreground">+{activeMedications.length - 3} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Medical Conditions</p>
                </div>
                {activeConditions.length > 0 ? (
                  <div className="space-y-1">
                    {activeConditions.slice(0, 3).map((condition) => (
                      <p key={condition.id} className="text-sm">{condition.condition_name}</p>
                    ))}
                    {activeConditions.length > 3 && (
                      <p className="text-sm text-muted-foreground">+{activeConditions.length - 3} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">None recorded</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 8 Medical Vault Sections */}
      <div className="grid md:grid-cols-2 gap-6">
        <MedicationsSection 
          patientAccountId={patientAccount?.id}
          medications={medications || []}
        />
        
        <ConditionsSection 
          patientAccountId={patientAccount?.id}
          conditions={conditions || []}
        />
        
        <AllergiesSection 
          patientAccountId={patientAccount?.id}
          allergies={allergies || []}
        />
        
        <VitalsSection 
          patientAccountId={patientAccount?.id}
          latestVitals={vitals?.[0]}
        />
        
        <ImmunizationsSection 
          patientAccountId={patientAccount?.id}
        />
        
        <SurgeriesSection 
          patientAccountId={patientAccount?.id}
        />
        
        <PharmaciesSection 
          patientAccountId={patientAccount?.id}
        />
        
        <EmergencyContactsSection 
          patientAccountId={patientAccount?.id}
        />
      </div>
    </div>
  );
}
