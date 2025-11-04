import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Calendar, Download, FileText, Mail, MapPin, 
  Phone, Printer, User, Eye, X, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { FollowUpManager } from "@/components/patients/FollowUpManager";
import { MedicalVaultView } from "@/components/medical-vault/MedicalVaultView";
import { MedicalVaultSummaryCard } from "@/components/medical-vault/MedicalVaultSummaryCard";
import { SharedDocumentsGrid } from "@/components/medical-vault/SharedDocumentsGrid";
import { CreateAppointmentDialog } from "@/components/calendar/CreateAppointmentDialog";
import { PatientAppointmentsList } from "@/components/patients/PatientAppointmentsList";
import { PatientPortalStatusBadge } from "@/components/patients/PatientPortalStatusBadge";
import { PatientNotesSection } from "@/components/patients/PatientNotesSection";
import { TreatmentPlansTab } from "@/components/treatment-plans/TreatmentPlansTab";
import { generateMedicalVaultPDF } from "@/lib/medicalVaultPdfGenerator";
import { PDFViewer } from "@/components/documents/PDFViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { realtimeManager } from "@/lib/realtimeManager";

export default function PatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const { effectivePracticeId } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');

  console.log('[PatientDetail] effectivePracticeId:', effectivePracticeId);

  const practiceId = effectivePracticeId;

  // First, resolve the patient_account_id (handle both old patient_id and new patient_account_id)
  const { data: resolvedPatientAccountId, isLoading: isResolvingId } = useQuery({
    queryKey: ['resolve-patient-id', patientId],
    queryFn: async () => {
      // Try direct lookup first (assuming it's a patient_account_id)
      const { data: directData, error: directError } = await supabase
        .from('patient_accounts')
        .select('id')
        .eq('id', patientId)
        .maybeSingle();

      if (directData) {
        return patientId; // It's already a patient_account_id
      }

      // If not found, try to map from old patient_id
      const { data: mappedData, error: mappedError } = await supabase
        .from('v_patients_with_portal_status')
        .select('patient_account_id')
        .eq('patient_id', patientId)
        .maybeSingle();

      if (mappedData?.patient_account_id) {
        return mappedData.patient_account_id;
      }

      return null; // Not found
    },
    enabled: !!patientId,
  });

  const actualPatientId = resolvedPatientAccountId || patientId;

  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient', actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('*')
        .eq('id', actualPatientId)
        .maybeSingle();

      if (error) {
        console.error('[PatientDetail] Error fetching patient:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('[PatientDetail] Patient not found or no access:', { actualPatientId, effectivePracticeId });
        return null;
      }
      
      return {
        ...data,
        name: data ? `${data.first_name} ${data.last_name}` : "",
      };
    },
    enabled: !!actualPatientId && !isResolvingId,
    staleTime: 30000,
  });

  // Fetch portal status
  const { data: portalStatus } = useQuery({
    queryKey: ['patient-portal-status', actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_patients_with_portal_status')
        .select('*')
        .eq('patient_account_id', actualPatientId)
        .maybeSingle();

      if (error) {
        console.error('Portal status error:', error);
        return null;
      }
      return data;
    },
    enabled: !!actualPatientId && !isResolvingId,
    staleTime: 10000,
  });

  // Realtime subscriptions for all patient data
  useEffect(() => {
    if (!actualPatientId) return;

    // Subscribe to patient account changes
    realtimeManager.subscribe('patient_accounts', () => {
      queryClient.invalidateQueries({ queryKey: ['patient', actualPatientId] });
      queryClient.invalidateQueries({ queryKey: ['patient-portal-status', actualPatientId] });
    });

    return () => {
      // Subscriptions are managed globally by realtimeManager
    };
  }, [actualPatientId, queryClient]);

  // Fetch providers for appointment dialog
  const { data: providers = [] } = useQuery({
    queryKey: ["providers", practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("providers")
        .select("id, user_id, profiles!inner(full_name, prescriber_name)")
        .eq("practice_id", practiceId)
        .order('prescriber_name', { ascending: true, foreignTable: 'profiles' });
      
      if (error) throw error;
      return data;
    },
    enabled: !!practiceId,
  });

  // Fetch rooms for appointment dialog
  const { data: rooms = [] } = useQuery({
    queryKey: ["rooms", practiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("practice_rooms")
        .select("*")
        .eq("practice_id", practiceId)
        .order("name");
      
      if (error) throw error;
      return data;
    },
    enabled: !!practiceId,
  });

  // Fetch medical data for PDF generation
  const { data: medications = [] } = useQuery({
    queryKey: ["patient-medications", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_medications")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: conditions = [] } = useQuery({
    queryKey: ["patient-conditions", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_conditions")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: allergies = [] } = useQuery({
    queryKey: ["patient-allergies", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_allergies")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: vitals = [] } = useQuery({
    queryKey: ["patient-vitals", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_vitals")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: immunizations = [] } = useQuery({
    queryKey: ["patient-immunizations", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_immunizations")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("date_administered", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: surgeries = [] } = useQuery({
    queryKey: ["patient-surgeries", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_surgeries")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: pharmacies = [] } = useQuery({
    queryKey: ["patient-pharmacies", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_pharmacies")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const { data: emergencyContacts = [] } = useQuery({
    queryKey: ["patient-emergency-contacts", actualPatientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_emergency_contacts")
        .select("*")
        .eq("patient_account_id", actualPatientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actualPatientId,
  });

  const handleViewChart = async () => {
    console.log("[PatientDetail] handleViewChart called with patient:", patient);
    
    if (!patient) {
      console.error("[PatientDetail] No patient data available");
      toast({
        variant: "destructive",
        title: "Error",
        description: "Patient data not loaded. Please refresh the page.",
      });
      return;
    }
    
    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generateMedicalVaultPDF(
        patient,
        medications,
        conditions,
        allergies,
        vitals,
        immunizations,
        surgeries,
        pharmacies,
        emergencyContacts
      );
      
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      setPreviewDialogOpen(true);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate medical chart PDF.",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrintFromViewer = () => {
    if (!pdfPreviewUrl) return;
    
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.src = pdfPreviewUrl;
    
    document.body.appendChild(printFrame);
    
    printFrame.onload = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(printFrame);
          }, 1000);
        } catch (err) {
          console.error('Print error:', err);
          document.body.removeChild(printFrame);
        }
      }, 500);
    };
  };

  const handleDownloadChart = async () => {
    if (!patient) return;
    
    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generateMedicalVaultPDF(
        patient,
        medications,
        conditions,
        allergies,
        vitals,
        immunizations,
        surgeries,
        pharmacies,
        emergencyContacts
      );
      
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${patient.name.replace(/\s+/g, "_")}_Medical_Chart.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: "Medical chart downloaded successfully.",
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to download medical chart.",
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading || isResolvingId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="patient-container">
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-muted flex items-center justify-center">
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Patient Not Found</h2>
          <p className="text-muted-foreground mb-6">
            This patient does not exist or you don't have permission to view their information.
          </p>
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
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold gold-text-gradient">
                {patient.name}
              </h1>
              {portalStatus && (
                <PatientPortalStatusBadge 
                  userId={portalStatus.user_id}
                  lastLoginAt={portalStatus.last_login_at}
                />
              )}
            </div>
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
            <p className="font-medium">{patient.address_formatted || patient.address || "Not provided"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date of Birth</p>
            <p className="font-medium">
              {patient.date_of_birth 
                ? new Date(patient.date_of_birth).toLocaleDateString() 
                : "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Emergency Contact</p>
            <p className="font-medium">
              {patient.emergency_contact_name 
                ? `${patient.emergency_contact_name}${patient.emergency_contact_phone ? ` - ${patient.emergency_contact_phone}` : ''}` 
                : "Not provided"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="w-full overflow-x-auto flex-nowrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical-vault">Medical Vault</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="treatment-plans">Treatment Plans</TabsTrigger>
          <TabsTrigger value="follow-ups">Follow-Ups</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {!patient.intake_completed_at && (
            <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Patient Intake Form</h3>
                    <p className="text-sm text-muted-foreground">
                      Complete the medical intake form on behalf of this patient to populate their medical vault.
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate(`/patients/${patientId}/intake`)}
                    className="touch-target"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Complete Intake Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 mb-4 flex-wrap">
            <Button 
              variant="outline" 
              onClick={handleViewChart}
              disabled={isGeneratingPdf}
            >
              <Eye className="h-4 w-4 mr-2" />
              {isGeneratingPdf ? "Generating..." : "View Chart"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadChart}
              disabled={isGeneratingPdf}
            >
              <Download className="h-4 w-4 mr-2" />
              Download Chart
            </Button>
            <Button variant="outline" onClick={() => setAppointmentDialogOpen(true)}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule Appointment
            </Button>
          </div>
          
          <MedicalVaultSummaryCard 
            patientAccountId={actualPatientId!} 
            onViewVault={() => setActiveTab('medical-vault')}
          />
        </TabsContent>

        <TabsContent value="medical-vault">
          <MedicalVaultView 
            patientAccountId={actualPatientId!}
            mode="practice"
            canEdit={true}
            showHeader={true}
            patientName={patient.name}
          />
        </TabsContent>

        <TabsContent value="notes">
          <PatientNotesSection 
            patientAccountId={actualPatientId!}
            patientName={patient.name}
          />
        </TabsContent>

        <TabsContent value="follow-ups">
          <FollowUpManager patientId={actualPatientId!} patientName={patient.name} />
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          {(effectivePracticeId || patient?.practice_id) ? (
            <PatientAppointmentsList 
              patientId={actualPatientId!} 
              practiceId={effectivePracticeId || patient.practice_id}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Unable to load appointments - practice ID not found</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="treatment-plans">
          <TreatmentPlansTab 
            patientAccountId={actualPatientId!} 
            providers={providers?.map((p: any) => ({ id: p.id, name: p.profiles?.prescriber_name || p.profiles?.full_name || 'Unknown' })) || []}
          />
        </TabsContent>

        <TabsContent value="documents">
          <SharedDocumentsGrid patientAccountId={actualPatientId!} mode="practice" />
        </TabsContent>
      </Tabs>

      {/* Appointment Dialog */}
      {practiceId && (
        <CreateAppointmentDialog
          open={appointmentDialogOpen}
          onOpenChange={setAppointmentDialogOpen}
          practiceId={practiceId}
          providers={providers}
          rooms={rooms}
          defaultPatientId={actualPatientId}
        />
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open && pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Medical Chart Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewUrl && (
              <PDFViewer 
                url={pdfPreviewUrl} 
                onDownload={handleDownloadChart}
                onPrint={handlePrintFromViewer}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
