import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, Eye, Printer, Download, Share2, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import { AuditLogDialog } from "@/components/medical-vault/dialogs/AuditLogDialog";
import { generateMedicalVaultPDF } from "@/lib/medicalVaultPdfGenerator";
import { ShareConsentDialog } from "@/components/medical-vault/ShareConsentDialog";
import { ShareLinkDialog } from "@/components/medical-vault/ShareLinkDialog";
import { logPatientPHIAccess } from "@/lib/auditLogger";
import { useAuth } from "@/contexts/AuthContext";
import { MedicationsSection } from "@/components/medical-vault/MedicationsSection";
import { ConditionsSection } from "@/components/medical-vault/ConditionsSection";
import { AllergiesSection } from "@/components/medical-vault/AllergiesSection";
import { VitalsSection } from "@/components/medical-vault/VitalsSection";
import { ImmunizationsSection } from "@/components/medical-vault/ImmunizationsSection";
import { SurgeriesSection } from "@/components/medical-vault/SurgeriesSection";
import { PharmaciesSection } from "@/components/medical-vault/PharmaciesSection";
import { EmergencyContactsSection } from "@/components/medical-vault/EmergencyContactsSection";
import { BasicDemographicsCard } from "@/components/patient/BasicDemographicsCard";
import { PDFViewer } from "@/components/documents/PDFViewer";
import { realtimeManager } from "@/lib/realtimeManager";

interface MedicalVaultViewProps {
  patientAccountId: string;
  mode: 'patient' | 'practice';
  canEdit: boolean;
  showHeader?: boolean;
  patientName?: string;
}

export function MedicalVaultView({ 
  patientAccountId, 
  mode, 
  canEdit, 
  showHeader = true,
  patientName 
}: MedicalVaultViewProps) {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareExpiresAt, setShareExpiresAt] = useState<Date>(new Date());
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { effectiveRole, user } = useAuth();

  // Fetch audit logs
  const { data: auditLogs = [], isLoading: isLoadingAuditLogs } = useAuditLogs(patientAccountId);

  // Real-time subscriptions for automatic updates
  useEffect(() => {
    if (patientAccountId) {
      console.log(`[MedicalVault] Subscribing to realtime updates for patient ${patientAccountId}`);
      
      const tables = [
        'patient_medications',
        'patient_conditions',
        'patient_allergies',
        'patient_vitals',
        'patient_immunizations',
        'patient_surgeries',
        'patient_pharmacies',
        'patient_emergency_contacts',
        'patient_documents',
      ];
      
      tables.forEach(table => {
        realtimeManager.subscribe(table);
      });
      
      return () => {
        console.log('[MedicalVault] Component unmounting');
        // RealtimeManager handles cleanup automatically
      };
    }
  }, [patientAccountId]);

  // Fetch patient account data
  const { data: patientAccount, isLoading: isLoadingAccount } = useQuery({
    queryKey: ["patient-account-vault", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_accounts")
        .select("id, first_name, last_name, practice_id, date_of_birth, address, city, state, zip_code, gender_at_birth, user_id")
        .eq("id", patientAccountId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });

  // Fetch all medical data
  const { data: medications } = useQuery({
    queryKey: ["patient-medications", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_medications")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });

  const { data: conditions } = useQuery({
    queryKey: ["patient-conditions", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_conditions")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });

  const { data: allergies } = useQuery({
    queryKey: ["patient-allergies", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_allergies")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!patientAccountId,
  });

  const { data: vitals } = useQuery({
    queryKey: ["patient-vitals", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_vitals")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("date_recorded", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccountId,
  });

  const { data: immunizations } = useQuery({
    queryKey: ["patient-immunizations", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_immunizations")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("date_administered", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccountId,
  });

  const { data: surgeries } = useQuery({
    queryKey: ["patient-surgeries", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_surgeries")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("surgery_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccountId,
  });

  const { data: pharmacies } = useQuery({
    queryKey: ["patient-pharmacies", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_pharmacies")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("is_preferred", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccountId,
  });

  const { data: emergencyContacts } = useQuery({
    queryKey: ["patient-emergency-contacts", patientAccountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_emergency_contacts")
        .select("*")
        .eq("patient_account_id", patientAccountId)
        .order("contact_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccountId,
  });

  // HIPAA Compliance: Log PHI access when medical vault is viewed
  useEffect(() => {
    if (patientAccount && medications && allergies && user) {
      const hasPHI = 
        (allergies && allergies.length > 0) || 
        (medications && medications.length > 0) ||
        patientAccount.address;
      
      if (hasPHI) {
        // Determine relationship based on role
        let relationship: 'practice_admin' | 'provider' | 'admin' = 'practice_admin';
        if (effectiveRole === 'admin') {
          relationship = 'admin';
        } else if (effectiveRole === 'provider') {
          relationship = 'provider';
        }

        const displayName = patientName || `${patientAccount.first_name} ${patientAccount.last_name}`;

        logPatientPHIAccess({
          patientId: patientAccountId,
          patientName: displayName,
          accessedFields: {
            allergies: !!(allergies && allergies.length > 0),
            notes: !!(medications && medications.length > 0), // Medications contain notes
            address: !!patientAccount.address,
          },
          viewerRole: effectiveRole || (mode === 'patient' ? 'patient' : 'doctor'),
          relationship,
          componentContext: `MedicalVaultView - ${mode}`,
        });
      }
    }
  }, [patientAccount, medications, allergies, user, effectiveRole, patientAccountId, patientName, mode]);

  // PDF generation handlers
  const handleViewPDF = async () => {
    if (!patientAccount) {
      toast({ title: "Error", description: "Patient account not loaded", variant: "destructive" });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generateMedicalVaultPDF(
        patientAccount,
        medications || [],
        conditions || [],
        allergies || [],
        vitals || [],
        immunizations || [],
        surgeries || [],
        pharmacies || [],
        emergencyContacts || []
      );
      
      const pdfUrl = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(pdfUrl);
      setPreviewDialogOpen(true);
      
      toast({ title: "Success", description: "PDF preview loaded" });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
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

  const handleDownloadPDF = async () => {
    if (!patientAccount) {
      toast({ title: "Error", description: "Patient account not loaded", variant: "destructive" });
      return;
    }

    setIsGeneratingPdf(true);
    try {
      const pdfBlob = await generateMedicalVaultPDF(
        patientAccount,
        medications || [],
        conditions || [],
        allergies || [],
        vitals || [],
        immunizations || [],
        surgeries || [],
        pharmacies || [],
        emergencyContacts || []
      );
      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Medical_Vault_${patientAccount.first_name}_${patientAccount.last_name}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(pdfUrl);
      toast({ title: "Success", description: "PDF downloaded successfully" });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSharePDF = async () => {
    setShowConsentDialog(true);
  };

  const handleConsentGiven = async () => {
    if (!patientAccount) {
      toast({ title: "Error", description: "Patient account not loaded", variant: "destructive" });
      return;
    }

    setShowConsentDialog(false);
    setIsGeneratingPdf(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Error", description: "Please log in to share medical vault", variant: "destructive" });
        return;
      }

      const token = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

      const { error: insertError } = await supabase
        .from('medical_vault_share_links')
        .insert({
          patient_id: patientAccountId,
          token,
          expires_at: expiresAt.toISOString(),
          consent_agreed_at: now.toISOString(),
          consent_ip: 'client-side',
        });

      if (insertError) {
        console.error('Error creating share link:', insertError);
        toast({ title: "Error", description: "Failed to create share link", variant: "destructive" });
        return;
      }

      const baseUrl = window.location.origin;
      const url = `${baseUrl}/share/${token}`;

      setShareUrl(url);
      setShareExpiresAt(expiresAt);
      setShowShareLinkDialog(true);

      toast({ title: "Success", description: "Share link created successfully" });
    } catch (error) {
      console.error('Error creating share link:', error);
      toast({ title: "Error", description: "Failed to create share link", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const displayName = patientName || 
    (patientAccount ? `${patientAccount.first_name} ${patientAccount.last_name}` : 'Patient');

  return (
    <div className={mode === 'patient' ? "patient-container" : ""}>
      <ShareConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsent={handleConsentGiven}
      />

      <ShareLinkDialog
        open={showShareLinkDialog}
        onOpenChange={setShowShareLinkDialog}
        shareUrl={shareUrl}
        expiresAt={shareExpiresAt}
      />

      {/* Audit Log Dialog */}
      <AuditLogDialog
        open={auditDialogOpen}
        onOpenChange={setAuditDialogOpen}
        auditLogs={auditLogs}
        patientName={displayName}
        patientAccountId={patientAccountId}
        isLoading={isLoadingAuditLogs}
      />

      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open && pdfPreviewUrl) {
          URL.revokeObjectURL(pdfPreviewUrl);
          setPdfPreviewUrl(null);
        }
      }}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>Medical Vault Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewUrl && (
              <PDFViewer 
                url={pdfPreviewUrl} 
                onDownload={handleDownloadPDF}
                onPrint={handlePrintFromViewer}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {showHeader && (
        <Card className="border-0 bg-gradient-to-br from-gold1/10 via-gold2/5 to-white dark:from-gray-900 dark:via-gray-800 dark:to-black text-foreground dark:text-white shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-r from-gold1/20 via-gold2/10 to-transparent dark:from-gold1/10 dark:via-gold2/5 dark:to-transparent animate-pulse"></div>
          
          <CardHeader className="relative z-10 py-8">
            <div className="flex flex-col items-center justify-center space-y-4 max-w-4xl mx-auto">
              <div className="relative">
                <div className="absolute inset-0 bg-gold1/30 blur-2xl rounded-full animate-pulse"></div>
                <ShieldCheck className="h-16 w-16 text-gold1 relative z-10 drop-shadow-2xl" strokeWidth={1.5} />
              </div>
              
              <div className="text-center space-y-1">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-gold1 via-gold1 to-gold2 bg-clip-text text-transparent">
                  {mode === 'patient' ? 'My Medical Vault' : `${displayName} - Medical Vault`}
                </h1>
                <p className="text-muted-foreground dark:text-gray-300 text-xs md:text-sm font-light tracking-wide">
                  powered by VitaLuxe Services
                </p>
              </div>
              
              <div className="flex flex-wrap gap-1.5 justify-center pt-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleViewPDF}
                  disabled={isGeneratingPdf}
                  className="bg-gold1/10 dark:bg-white/10 backdrop-blur-md border-gold1/50 dark:border-white/20 hover:bg-gold1/20 dark:hover:bg-white/20 text-gold1 dark:text-white hover:text-gold1 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-gold1/50 dark:hover:shadow-yellow-500/50 disabled:opacity-50"
                >
                  <Eye className="h-3 w-3" />
                  {isGeneratingPdf ? 'Generating...' : 'View'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleViewPDF}
                  disabled={isGeneratingPdf}
                  className="bg-gold1/10 dark:bg-white/10 backdrop-blur-md border-gold1/50 dark:border-white/20 hover:bg-gold1/20 dark:hover:bg-white/20 text-gold1 dark:text-white hover:text-gold1 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-gold1/50 dark:hover:shadow-yellow-500/50 disabled:opacity-50"
                >
                  <Printer className="h-3 w-3" />
                  Print
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPdf}
                  className="bg-gold1/10 dark:bg-white/10 backdrop-blur-md border-gold1/50 dark:border-white/20 hover:bg-gold1/20 dark:hover:bg-white/20 text-gold1 dark:text-white hover:text-gold1 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-gold1/50 dark:hover:shadow-yellow-500/50 disabled:opacity-50"
                >
                  <Download className="h-3 w-3" />
                  Download
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setAuditDialogOpen(true)}
                  className="bg-gold1/10 dark:bg-white/10 backdrop-blur-md border-gold1/50 dark:border-white/20 hover:bg-gold1/20 dark:hover:bg-white/20 text-gold1 dark:text-white hover:text-gold1 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-gold1/50 dark:hover:shadow-yellow-500/50"
                >
                  <ClipboardList className="h-3 w-3" />
                  Audit
                </Button>
                {mode === 'patient' && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSharePDF}
                    disabled={isGeneratingPdf}
                     className="bg-gold1/10 dark:bg-white/10 backdrop-blur-md border-gold1/50 dark:border-white/20 hover:bg-gold1/20 dark:hover:bg-white/20 text-gold1 dark:text-white hover:text-gold1 dark:hover:text-white transition-all duration-300 shadow-lg hover:shadow-gold1/50 dark:hover:shadow-yellow-500/50 disabled:opacity-50"
                  >
                    <Share2 className="h-3 w-3" />
                    Share
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <BasicDemographicsCard 
        patientAccount={patientAccount}
        effectiveUserId={patientAccount?.user_id || ''}
      />

      <div className="grid md:grid-cols-2 gap-6">
        <MedicationsSection 
          patientAccountId={patientAccountId}
          medications={medications || []}
        />
        
        <ConditionsSection 
          patientAccountId={patientAccountId}
          conditions={conditions || []}
        />
        
        <AllergiesSection 
          patientAccountId={patientAccountId}
          allergies={allergies || []}
        />
        
        <VitalsSection 
          patientAccountId={patientAccountId}
          vitals={vitals || []}
        />
        
        <ImmunizationsSection 
          patientAccountId={patientAccountId}
        />
        
        <SurgeriesSection 
          patientAccountId={patientAccountId}
        />
        
        <PharmaciesSection 
          patientAccountId={patientAccountId}
        />
        
        <EmergencyContactsSection 
          patientAccountId={patientAccountId}
        />
      </div>
    </div>
  );
}
