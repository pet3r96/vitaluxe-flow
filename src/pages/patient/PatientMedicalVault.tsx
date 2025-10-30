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
      {/* Medical Vault Header - Modern Design */}
      <Card className="border-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white shadow-2xl overflow-hidden relative">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 via-yellow-600/5 to-transparent animate-pulse"></div>
        
        <CardHeader className="relative z-10 py-12">
          {/* Centered Content Container */}
          <div className="flex flex-col items-center justify-center space-y-6 max-w-4xl mx-auto">
            
            {/* Modern Shield Icon with Glow Effect */}
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500/30 blur-3xl rounded-full animate-pulse"></div>
              <ShieldCheck className="h-24 w-24 text-yellow-500 relative z-10 drop-shadow-2xl" strokeWidth={1.5} />
            </div>
            
            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                Medical Vault
              </h1>
              <p className="text-gray-300 text-sm md:text-base font-light tracking-wide">
                Secure Health Information
              </p>
            </div>
            
            {/* Patient Name Badge */}
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-8 py-3 shadow-xl">
              <p className="text-lg md:text-xl font-semibold text-white">
                {patientAccount?.first_name && patientAccount?.last_name 
                  ? `${patientAccount.first_name} ${patientAccount.last_name}`
                  : 'Patient Name Not Set'}
              </p>
            </div>
            
            {/* Action Buttons - Modern Glass Morphism Style */}
            <div className="flex flex-wrap gap-3 justify-center pt-4">
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Eye className="h-4 w-4" />
                View
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50"
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
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
