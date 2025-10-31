import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Activity, AlertCircle, Pill, Heart, Syringe, Scissors, Building2, Phone, ShieldCheck, Share2, Download, FileText, Eye, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { generateMedicalVaultPDF } from "@/lib/medicalVaultPdfGenerator";
import { ShareConsentDialog } from "@/components/medical-vault/ShareConsentDialog";
import { ShareLinkDialog } from "@/components/medical-vault/ShareLinkDialog";
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

export default function PatientMedicalVault() {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [shareExpiresAt, setShareExpiresAt] = useState<Date>(new Date());

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

  // Fetch immunizations
  const { data: immunizations } = useQuery({
    queryKey: ["patient-immunizations", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_immunizations")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("date_administered", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  // Fetch surgeries
  const { data: surgeries } = useQuery({
    queryKey: ["patient-surgeries", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_surgeries")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("surgery_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  // Fetch pharmacies
  const { data: pharmacies } = useQuery({
    queryKey: ["patient-pharmacies", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_pharmacies")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("is_preferred", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  // Fetch emergency contacts
  const { data: emergencyContacts } = useQuery({
    queryKey: ["patient-emergency-contacts", patientAccount?.id],
    queryFn: async () => {
      if (!patientAccount?.id) return [];
      const { data, error } = await supabase
        .from("patient_emergency_contacts")
        .select("*")
        .eq("patient_account_id", patientAccount.id)
        .order("contact_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientAccount?.id,
  });

  const activeAllergies = allergies?.filter(a => a.is_active && !a.nka) || [];
  const activeMedications = medications?.filter(m => m.is_active) || [];
  const activeConditions = conditions?.filter(c => c.is_active) || [];
  const hasNKA = allergies?.some(a => a.nka) || false;

  // Button handlers for PDF actions
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
      
      // In-app preview (dialog) using object/embed for better compatibility
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

  const handlePrintPDF = async () => {
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
      
      // Create blob URL
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      // Create a hidden iframe directly in the DOM (bypasses popup blockers)
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'fixed';
      printFrame.style.right = '0';
      printFrame.style.bottom = '0';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      printFrame.src = pdfUrl;
      
      document.body.appendChild(printFrame);
      
      // Wait for PDF to load, then trigger print
      printFrame.onload = () => {
        try {
          // Small delay to ensure PDF is fully rendered
          setTimeout(() => {
            printFrame.contentWindow?.focus();
            printFrame.contentWindow?.print();
            
            // Cleanup after print dialog opens
            setTimeout(() => {
              document.body.removeChild(printFrame);
              URL.revokeObjectURL(pdfUrl);
            }, 1000);
          }, 500);
        } catch (err) {
          console.error('Print error:', err);
          document.body.removeChild(printFrame);
          URL.revokeObjectURL(pdfUrl);
          toast({ 
            title: "Print Failed", 
            description: "Unable to print. Try downloading instead.", 
            variant: "destructive" 
          });
        }
      };

      toast({ title: "Success", description: "Opening print dialog..." });
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
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
    // Step 1: Show consent dialog
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
        toast({ title: "Error", description: "Please log in to share your medical vault", variant: "destructive" });
        return;
      }

      // Generate secure token
      const token = crypto.randomUUID();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      // Create share link in database
      const { error: insertError } = await supabase
        .from('medical_vault_share_links')
        .insert({
          patient_id: patientAccount.id,
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

      // Log consent given
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        user_role: 'patient',
        action_type: 'medical_vault_share_consent_given',
        entity_type: 'medical_vault_share_links',
        entity_id: patientAccount.id,
        details: {
          patient_id: patientAccount.id,
          patient_name: `${patientAccount.first_name} ${patientAccount.last_name}`,
          token,
          expires_at: expiresAt.toISOString(),
        },
      });

      // Generate share URL
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

  return (
    <div className="space-y-6 p-6">
      {/* Consent Dialog */}
      <ShareConsentDialog
        open={showConsentDialog}
        onOpenChange={setShowConsentDialog}
        onConsent={handleConsentGiven}
      />

      {/* Share Link Dialog */}
      <ShareLinkDialog
        open={showShareLinkDialog}
        onOpenChange={setShowShareLinkDialog}
        shareUrl={shareUrl}
        expiresAt={shareExpiresAt}
      />

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
            <DialogTitle>Medical Vault Preview</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {pdfPreviewUrl && (
              <PDFViewer 
                url={pdfPreviewUrl} 
                onDownload={handleDownloadPDF}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                {isLoading ? (
                  "Loading Secure Medical Vault"
                ) : error ? (
                  "Secure Medical Vault"
                ) : patientAccount?.first_name && patientAccount?.last_name ? (
                  `${patientAccount.first_name} ${patientAccount.last_name} Secure Medical Vault`
                ) : patientAccount?.first_name || patientAccount?.last_name ? (
                  `${patientAccount.first_name || ''} ${patientAccount.last_name || ''}`.trim() + " Secure Medical Vault"
                ) : (
                  "Patient Secure Medical Vault"
                )}
              </h1>
              <p className="text-gray-300 text-xs md:text-sm font-light tracking-wide">
                powered by VitaLuxe Services
              </p>
            </div>
            
            {/* Action Buttons - Reduced size */}
            <div className="flex flex-wrap gap-1.5 justify-center pt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleViewPDF}
                disabled={isGeneratingPdf}
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50"
              >
                <Eye className="h-3 w-3" />
                {isGeneratingPdf ? 'Generating...' : 'View'}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handlePrintPDF}
                disabled={isGeneratingPdf}
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50"
              >
                <Printer className="h-3 w-3" />
                Print
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleDownloadPDF}
                disabled={isGeneratingPdf}
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                Download
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleSharePDF}
                disabled={isGeneratingPdf}
                className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/20 text-white hover:text-white transition-all duration-300 shadow-lg hover:shadow-yellow-500/50 disabled:opacity-50"
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
