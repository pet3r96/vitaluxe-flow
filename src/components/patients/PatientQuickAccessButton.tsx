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
import { logger } from "@/lib/logger";

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

      // OPTIMIZED: Use service layer RPC instead of 8 sequential queries
      if (!data) {
        const [accountResult, vaultResult] = await Promise.all([
          supabase
            .from("patient_accounts")
            .select("*")
            .eq("id", patientId)
            .maybeSingle(),
          supabase.rpc('get_patient_vault_grouped', {
            p_patient_account_id: patientId
          })
        ]);
        
        if (accountResult.error) throw accountResult.error;
        if (!accountResult.data) throw new Error("Patient not found or you don't have access");

        const vaultData = (vaultResult.data || {}) as any;

        data = {
          account: accountResult.data,
          medications: (vaultData.medications || []) as any,
          conditions: (vaultData.conditions || []) as any,
          allergies: (vaultData.allergies || []) as any,
          vitals: (vaultData.vitals || []) as any,
          immunizations: (vaultData.immunizations || []) as any,
          surgeries: (vaultData.surgeries || []) as any,
          pharmacies: (vaultData.pharmacies || []) as any,
          emergencyContacts: (vaultData.emergency_contacts || []) as any,
        };
      }

      // JUSTIFIED: JSONB boundary - generateMedicalVaultPDF uses dynamic record_data structures
      const pdfBlob = await generateMedicalVaultPDF(
        data.account,
        data.medications as any,
        data.conditions as any,
        data.allergies as any,
        data.vitals as any,
        data.immunizations as any,
        data.surgeries as any,
        data.pharmacies as any,
        data.emergencyContacts as any
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
      logger.error('Failed to generate PDF', error);
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
