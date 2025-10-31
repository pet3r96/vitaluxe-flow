import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, User, FileText, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { FollowUpManager } from "@/components/patients/FollowUpManager";
import { MedicalVaultView } from "@/components/medical-vault/MedicalVaultView";
import { MedicalVaultSummaryCard } from "@/components/medical-vault/MedicalVaultSummaryCard";
import { SharedDocumentsGrid } from "@/components/medical-vault/SharedDocumentsGrid";

export default function PatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";

  const { data: patient, isLoading } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("*")
        .eq("id", patientId)
        .single();

      if (error) throw error;
      
      // Map patient_accounts fields to match expected format
      return {
        ...data,
        name: data ? `${data.first_name} ${data.last_name}` : "",
        address: data?.address && data?.city && data?.state && data?.zip_code
          ? `${data.address}, ${data.city}, ${data.state} ${data.zip_code}`
          : data?.address || "Not provided",
      };
    },
    enabled: !!patientId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="patient-container">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Patient not found</h2>
          <Button onClick={() => navigate("/patients")} className="touch-target">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Patients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/patients")} className="touch-target-sm">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 sm:flex-none">
            <h1 className="text-2xl sm:text-3xl font-bold gold-text-gradient">
              {patient.name}
            </h1>
            <p className="text-sm text-muted-foreground break-all">{patient.email}</p>
          </div>
        </div>
      </div>

      {/* Patient Info Card */}
      <Card className="patient-card mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <User className="h-5 w-5" />
            Patient Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Phone</p>
            <p className="font-medium">{patient.phone || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{patient.email || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Address</p>
            <p className="font-medium">{patient.address || "Not provided"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => navigate(`/patients/${patientId}?tab=${v}`)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical-vault">Medical Vault</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-Ups</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="forms">Forms</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" onClick={() => navigate(`/practice/patients/${patientId}/medical-vault`)}>
              <FileText className="h-4 w-4 mr-2" />
              View Full Medical Vault
            </Button>
            <Button variant="outline" onClick={() => navigate(`/practice-calendar?patient=${patientId}`)}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Appointment
            </Button>
          </div>
          
          <MedicalVaultSummaryCard patientAccountId={patientId!} />
          
          <Card>
            <CardHeader>
              <CardTitle>Patient Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Date of Birth</p>
                  <p className="text-sm">
                    {patient.date_of_birth 
                      ? new Date(patient.date_of_birth).toLocaleDateString() 
                      : "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Gender</p>
                  <p className="text-sm capitalize">
                    {patient.gender_at_birth || "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Emergency Contact</p>
                  <p className="text-sm">
                    {patient.emergency_contact_name 
                      ? `${patient.emergency_contact_name}${patient.emergency_contact_phone ? ` - ${patient.emergency_contact_phone}` : ''}` 
                      : "Not provided"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Status</p>
                  <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                    {patient.status || 'active'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical-vault">
          <MedicalVaultView 
            patientAccountId={patientId!}
            mode="practice"
            canEdit={true}
            showHeader={false}
            patientName={patient.name}
          />
        </TabsContent>

        <TabsContent value="follow-ups">
          <FollowUpManager patientId={patientId!} patientName={patient.name} />
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Appointment history will be displayed here
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <SharedDocumentsGrid patientAccountId={patientId!} mode="practice" />
        </TabsContent>

        <TabsContent value="forms">
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Patient forms will be displayed here
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
