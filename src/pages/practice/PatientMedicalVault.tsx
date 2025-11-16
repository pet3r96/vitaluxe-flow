import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MedicalVaultView } from "@/components/medical-vault/MedicalVaultView";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function PracticePatientMedicalVault() {
  const { patientId } = useParams();
  const navigate = useNavigate();

  const { data: patientAccount, isLoading, error } = useQuery({
    queryKey: ["patient-account-practice", patientId],
    queryFn: async () => {
      if (!patientId) throw new Error("Patient ID is required");
      
      console.log('[PracticePatientMedicalVault] Fetching patient account for:', patientId);
      
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name, practice_id")
        .eq("id", patientId)
        .single();
      
      if (error) {
        console.error('[PracticePatientMedicalVault] Query error:', error);
        throw error;
      }
      
      console.log('[PracticePatientMedicalVault] Patient account data:', data);
      return data;
    },
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !patientAccount) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-destructive mb-4">
          Unable to load patient medical vault
        </h2>
        <p className="text-muted-foreground mb-6">
          {error?.message || "Patient not found or access denied"}
        </p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const patientName = `${patientAccount.first_name} ${patientAccount.last_name}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate('/patients')}
        >
          Patients
        </Button>
        <span>/</span>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => navigate(`/patients/${patientId}`)}
        >
          {patientName}
        </Button>
        <span>/</span>
        <span className="text-foreground font-medium">Medical Vault</span>
      </div>

      {/* Back Button */}
      <Button 
        variant="outline" 
        onClick={() => navigate(`/patients/${patientId}`)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Patient Profile
      </Button>

      {/* Medical Vault View */}
      <MedicalVaultView 
        patientAccountId={patientAccount.id}
        mode="practice"
        canEdit={true}
        showHeader={true}
        patientName={patientName}
      />
    </div>
  );
}
