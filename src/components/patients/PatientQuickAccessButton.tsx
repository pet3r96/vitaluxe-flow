import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, FolderOpen, Calendar, Download, MessageCircle, ChevronDown, MoreVertical } from "lucide-react";
import { generateMedicalVaultPDF } from "@/lib/medicalVaultPdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { usePatientMedicalData } from "@/hooks/usePatientMedicalData";

interface PatientQuickAccessButtonProps {
  patientId: string;
  patientName: string;
  variant?: 'icon' | 'button' | 'inline';
  size?: 'sm' | 'default' | 'lg';
  showLabel?: boolean;
  onViewMedicalVault?: () => void;
}

export function PatientQuickAccessButton({ 
  patientId, 
  patientName, 
  variant = 'icon',
  size = 'sm',
  showLabel = true,
  onViewMedicalVault
}: PatientQuickAccessButtonProps) {
  const navigate = useNavigate();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fetch patient data for PDF generation using service layer
  const { data: patientData, refetch: refetchPatientData } = usePatientMedicalData(patientId, false);

  const handleViewMedicalVault = () => {
    if (onViewMedicalVault) {
      onViewMedicalVault();
    } else {
      navigate(`/patients/${patientId}?tab=medical-vault`);
    }
  };

  const handleViewDocuments = () => {
    navigate(`/patients/${patientId}?tab=documents`);
  };

  const handleScheduleAppointment = () => {
    navigate(`/practice-calendar?patient=${patientId}`);
  };

  const handleGeneratePDF = async () => {
    setIsGeneratingPdf(true);
    try {
      // Fetch data if not already loaded
      let data = patientData;
      if (!data) {
        const result = await refetchPatientData();
        data = result.data;
        if (!data) {
          throw new Error("Failed to fetch patient data");
        }
      }

      // Fallback: if still no data, try direct fetch
      if (!data) {
        const { data: account, error: accountError } = await supabase
          .from("patient_accounts")
          .select("*")
          .eq("id", patientId)
          .maybeSingle();
        
        if (accountError) throw accountError;
        if (!account) throw new Error("Patient not found or you don't have access");

        const [medications, conditions, allergies, vitals, immunizations, surgeries, pharmacies, emergencyContacts] = await Promise.all([
          supabase.from("patient_medications").select("*").eq("patient_account_id", patientId).order("created_at", { ascending: false }),
          supabase.from("patient_conditions").select("*").eq("patient_account_id", patientId).order("created_at", { ascending: false }),
          supabase.from("patient_allergies").select("*").eq("patient_account_id", patientId).order("created_at", { ascending: false }),
          supabase.from("patient_vitals").select("*").eq("patient_account_id", patientId).order("date_recorded", { ascending: false }),
          supabase.from("patient_immunizations").select("*").eq("patient_account_id", patientId).order("date_administered", { ascending: false }),
          supabase.from("patient_surgeries").select("*").eq("patient_account_id", patientId).order("surgery_date", { ascending: false }),
          supabase.from("patient_pharmacies").select("*").eq("patient_account_id", patientId).order("is_preferred", { ascending: false }),
          supabase.from("patient_emergency_contacts").select("*").eq("patient_account_id", patientId).order("contact_order", { ascending: true }),
        ]);

        data = {
          account,
          medications: medications.data || [],
          conditions: conditions.data || [],
          allergies: allergies.data || [],
          vitals: vitals.data || [],
          immunizations: immunizations.data || [],
          surgeries: surgeries.data || [],
          pharmacies: pharmacies.data || [],
          emergencyContacts: emergencyContacts.data || [],
        };
      }

      const pdfBlob = await generateMedicalVaultPDF(
        data.account,
        data.medications,
        data.conditions,
        data.allergies,
        data.vitals,
        data.immunizations,
        data.surgeries,
        data.pharmacies,
        data.emergencyContacts
      );

      const pdfUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `Medical_Vault_${patientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
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

  const handleSendMessage = () => {
    navigate(`/internal-chat?patient=${patientId}`);
  };

  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size={size}
            className="h-6 w-6 p-0"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleViewMedicalVault}>
            <FileText className="h-4 w-4 mr-2" />
            View Medical Vault
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleViewDocuments}>
            <FolderOpen className="h-4 w-4 mr-2" />
            View Documents
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleScheduleAppointment}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Appointment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGeneratePDF} disabled={isGeneratingPdf}>
            <Download className="h-4 w-4 mr-2" />
            {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSendMessage}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Send Message
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'button') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size={size}>
            Quick Actions
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={handleViewMedicalVault}>
            <FileText className="h-4 w-4 mr-2" />
            View Medical Vault
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleViewDocuments}>
            <FolderOpen className="h-4 w-4 mr-2" />
            View Documents
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleScheduleAppointment}>
            <Calendar className="h-4 w-4 mr-2" />
            Schedule Appointment
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleGeneratePDF} disabled={isGeneratingPdf}>
            <Download className="h-4 w-4 mr-2" />
            {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSendMessage}>
            <MessageCircle className="h-4 w-4 mr-2" />
            Send Message
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // inline variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="link" size="sm" className="h-auto p-0 text-primary">
          Quick Actions
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={handleViewMedicalVault}>
          <FileText className="h-4 w-4 mr-2" />
          View Medical Vault
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleViewDocuments}>
          <FolderOpen className="h-4 w-4 mr-2" />
          View Documents
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleScheduleAppointment}>
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Appointment
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleGeneratePDF} disabled={isGeneratingPdf}>
          <Download className="h-4 w-4 mr-2" />
          {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleSendMessage}>
          <MessageCircle className="h-4 w-4 mr-2" />
          Send Message
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
