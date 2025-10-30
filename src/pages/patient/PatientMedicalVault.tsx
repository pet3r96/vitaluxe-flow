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
        <CardHeader className="pb-6">
          {/* Centered Title with Gold Lock */}
          <div className="flex flex-col items-center justify-center gap-3 mb-6">
            <CardTitle className="text-2xl font-bold">
              Medical Vault - Secure Health Information
            </CardTitle>
            <Lock className="h-12 w-12 text-yellow-600" />
          </div>

          {/* Three-column layout: Patient Info (left) | Spacer | Actions (right) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Left Column: Patient Info (left-aligned) */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Full Name:</span>
                <span className="font-medium">{patientAccount?.first_name} {patientAccount?.last_name || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">DOB:</span>
                <span className="font-medium">
                  {patientAccount?.date_of_birth 
                    ? format(new Date(patientAccount.date_of_birth), 'MM/dd/yyyy')
                    : 'Not set'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Phone Number:</span>
                <span className="font-medium">{patientAccount?.phone || 'Not set'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Gender:</span>
                <span className="font-medium">{patientAccount?.gender_at_birth || 'Not set'}</span>
              </div>
            </div>

            {/* Middle Column: Spacer */}
            <div></div>

            {/* Right Column: Actions & Metadata (right-aligned) */}
            <div className="space-y-4 flex flex-col items-end">
              {/* Action Buttons - Horizontal */}
              <div className="flex gap-2 flex-wrap justify-end">
                <Button variant="outline" size="sm" className="uppercase text-xs font-semibold">
                  Secure
                </Button>
                <Button variant="outline" size="sm" className="uppercase text-xs font-semibold">
                  Print
                </Button>
                <Button variant="outline" size="sm" className="uppercase text-xs font-semibold">
                  Download
                </Button>
                <Button variant="outline" size="sm" className="uppercase text-xs font-semibold">
                  Share
                </Button>
              </div>

              {/* Last Login */}
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="font-medium text-sm">
                  {patientAccount?.updated_at 
                    ? format(new Date(patientAccount.updated_at), 'MMM dd, yyyy hh:mm a')
                    : 'Not available'}
                </p>
              </div>

              {/* Practice */}
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Practice:</p>
                <p className="font-medium text-sm">Not assigned</p>
              </div>
            </div>
          </div>
        </CardHeader>
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
