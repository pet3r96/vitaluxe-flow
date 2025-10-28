import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MedicalRecordCard } from "@/components/patient/MedicalRecordCard";
import { Activity, AlertCircle, Pill, FileText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PatientMedicalVault() {
  const { data: medicalData } = useQuery({
    queryKey: ["patient-medical-vault"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_medical_vault")
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Medical Vault</h1>
        <p className="text-muted-foreground">Your secure health information</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="allergies">Allergies</TabsTrigger>
          <TabsTrigger value="medications">Medications</TabsTrigger>
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blood Type</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{medicalData?.blood_type || "N/A"}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Allergies</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {medicalData?.allergies ? (Array.isArray(medicalData.allergies) ? medicalData.allergies.length : 0) : 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Medications</CardTitle>
                <Pill className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {medicalData?.current_medications ? (Array.isArray(medicalData.current_medications) ? medicalData.current_medications.length : 0) : 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conditions</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {medicalData?.medical_conditions ? (Array.isArray(medicalData.medical_conditions) ? medicalData.medical_conditions.length : 0) : 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vital Signs</CardTitle>
              <CardDescription>Most recent measurements</CardDescription>
            </CardHeader>
            <CardContent>
              {medicalData?.vital_signs && typeof medicalData.vital_signs === 'object' ? (
                <div className="grid gap-4 md:grid-cols-3">
                  {Object.entries(medicalData.vital_signs).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <p className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
                      <p className="text-lg font-medium">{String(value)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No vital signs recorded</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allergies" className="space-y-4">
          <MedicalRecordCard
            title="Allergies"
            icon={AlertCircle}
            items={medicalData?.allergies && Array.isArray(medicalData.allergies) ? (medicalData.allergies as string[]) : []}
            emptyMessage="No allergies recorded"
          />
        </TabsContent>

        <TabsContent value="medications" className="space-y-4">
          <MedicalRecordCard
            title="Current Medications"
            icon={Pill}
            items={medicalData?.current_medications && Array.isArray(medicalData.current_medications) ? (medicalData.current_medications as string[]) : []}
            emptyMessage="No medications recorded"
          />
        </TabsContent>

        <TabsContent value="conditions" className="space-y-4">
          <MedicalRecordCard
            title="Medical Conditions"
            icon={FileText}
            items={medicalData?.medical_conditions && Array.isArray(medicalData.medical_conditions) ? (medicalData.medical_conditions as string[]) : []}
            emptyMessage="No conditions recorded"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
