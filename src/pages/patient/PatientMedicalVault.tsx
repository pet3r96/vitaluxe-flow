import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, Pill, Heart, Syringe, Scissors, Building2, Phone, ShieldCheck, Share2, Download, FileText, Eye, Printer } from "lucide-react";
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
import { BasicDemographicsCard } from "@/components/patient/BasicDemographicsCard";

export default function PatientMedicalVault() {
  // Get patient account - check for impersonation first
  const { data: patientAccount, isLoading, error } = useQuery({
    queryKey: ["patient-account"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("🔍 Current authenticated user:", user?.id, user?.email);
      
      if (!user) throw new Error("Not authenticated");
      
      // Check for active impersonation session
      const { data: impersonationData } = await supabase.functions.invoke('get-active-impersonation');
      const effectiveUserId = impersonationData?.session?.impersonated_user_id || user.id;
      
      console.log("👤 Effective user ID (impersonated or real):", effectiveUserId);
      
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name, practice_id, date_of_birth, address, city, state, zip_code, gender_at_birth")
        .eq("user_id", effectiveUserId)
        .maybeSingle();
      
      console.log("📋 Patient account query result:", data, error);
      
      if (error) throw error;
      return { ...data, effectiveUserId };
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
        .order("date_recorded", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const activeAllergies = allergies?.filter(a => a.is_active && !a.nka) || [];
  const activeMedications = medications?.filter(m => m.is_active) || [];
  const activeConditions = conditions?.filter(c => c.is_active) || [];
  const hasNKA = allergies?.some(a => a.nka) || false;

  return (
    <div className="space-y-6 p-6">
      {/* Medical Vault Header - Compact Modern Design */}
      <Card className="border-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white shadow-2xl overflow-hidden relative">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-yellow-600/5 to-transparent animate-pulse"></div>
        
        <CardHeader className="relative z-10 py-8">
          {/* Centered Content Container */}
          <div className="flex flex-col items-center justify-center space-y-4 max-w-4xl mx-auto">
            
            {/* Modern Shield Icon with Glow Effect - 30% smaller */}
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/30 blur-2xl rounded-full animate-pulse"></div>
              <ShieldCheck className="h-16 w-16 text-yellow-500 relative z-10 drop-shadow-2xl" strokeWidth={1.5} />
            </div>
            
            {/* Title - 30% smaller */}
            <div className="text-center space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                Medical Vault
              </h1>
              <p className="text-gray-300 text-xs md:text-sm font-light tracking-wide">
                Secure Health Information
              </p>
            </div>
            
            {/* Patient Name Badge - Reduced size */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 shadow-xl">
              <p className="text-sm md:text-base font-semibold text-white">
                {isLoading ? (
                  <span className="animate-pulse">Loading...</span>
                ) : error ? (
                  <span className="text-red-300">Error loading patient data</span>
                ) : patientAccount?.first_name && patientAccount?.last_name ? (
                  `${patientAccount.first_name} ${patientAccount.last_name}`
                ) : patientAccount?.first_name || patientAccount?.last_name ? (
                  `${patientAccount.first_name || ''} ${patientAccount.last_name || ''}`.trim()
                ) : (
                  'Patient Name Not Set'
                )}
              </p>
            </div>
            
            {/* Action Buttons - Reduced size */}
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Eye className="h-3 w-3" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Printer className="h-3 w-3" />
                Print
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Share2 className="h-3 w-3" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Basic Demographics Card */}
      <BasicDemographicsCard 
        patientAccount={patientAccount}
        effectiveUserId={patientAccount?.effectiveUserId || ''}
      />

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
          vitals={vitals || []}
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
