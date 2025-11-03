import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateMedicalVaultPDF } from "@/lib/medicalVaultPdfGenerator";
import { Loader2, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorType = 'invalid_token' | 'already_used' | 'expired' | 'revoked' | 'internal_error' | null;

export default function MedicalVaultShare() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorType>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('invalid_token');
      setLoading(false);
      return;
    }

    validateAndLoadPDF();
  }, [token]);

  const validateAndLoadPDF = async () => {
    try {
      console.log('[MedicalVaultShare] Starting validation for token:', token);
      setLoading(true);
      
      // Call edge function to validate token and get data
      console.log('[MedicalVaultShare] Calling edge function...');
      const { data, error: functionError } = await supabase.functions.invoke('validate-share-link', {
        body: { token }
      });

      console.log('[MedicalVaultShare] Edge function response:', { data, functionError });

      // Handle edge function errors (410, 404, etc.)
      if (functionError) {
        console.error('[MedicalVaultShare] Edge function error:', functionError);
        
        // Try multiple ways to extract error type from response
        let errorType: ErrorType = 'internal_error';
        
        // Method 1: Check context.body
        if (functionError.context?.body?.error) {
          errorType = functionError.context.body.error as ErrorType;
        }
        // Method 2: Check if error message is JSON string
        else if (functionError.message) {
          try {
            const parsed = JSON.parse(functionError.message);
            if (parsed.error) {
              errorType = parsed.error as ErrorType;
            }
          } catch {
            // Not JSON, continue
          }
        }
        // Method 3: Check direct error property
        else if ((functionError as any).error) {
          errorType = (functionError as any).error as ErrorType;
        }
        
        console.log('[MedicalVaultShare] Extracted error type:', errorType);
        setError(errorType);
        setLoading(false);
        return;
      }

      // Handle unsuccessful validation responses
      if (!data?.success) {
        console.log('[MedicalVaultShare] Data validation failed:', data);
        const errorType = data?.error || 'internal_error';
        setError(errorType as ErrorType);
        setLoading(false);
        return;
      }

      // Generate PDF from the returned data
      console.log('[MedicalVaultShare] Generating PDF from data...');
      const pdfBlob = await generateMedicalVaultPDF(
        data.patient,
        data.medications,
        data.conditions,
        data.allergies,
        data.vitals,
        data.immunizations,
        data.surgeries,
        data.pharmacies,
        data.emergencyContacts
      );

      console.log('[MedicalVaultShare] PDF generated successfully');
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      setLoading(false);

    } catch (err) {
      console.error('[MedicalVaultShare] Error loading shared medical vault:', err);
      setError('internal_error');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-lg text-muted-foreground">Loading medical vault...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6 text-center">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            {error === 'already_used' ? (
              <CheckCircle className="h-8 w-8 text-destructive" />
            ) : error === 'expired' ? (
              <Clock className="h-8 w-8 text-destructive" />
            ) : (
              <AlertCircle className="h-8 w-8 text-destructive" />
            )}
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">
              {error === 'already_used' && "Link Already Used"}
              {error === 'expired' && "Link Expired"}
              {error === 'invalid_token' && "Invalid Link"}
              {error === 'revoked' && "Link Revoked"}
              {error === 'internal_error' && "Error Loading Vault"}
            </h1>
            <p className="text-muted-foreground">
              {error === 'already_used' && "Sorry, this link has been accessed the maximum number of times (2 attempts). For security reasons, each share link can only be viewed twice."}
              {error === 'expired' && "Sorry, this link has expired after 60 minutes. For security reasons, access links are only valid for 1 hour."}
              {error === 'invalid_token' && "This share link is not valid. Please check the link and try again."}
              {error === 'revoked' && "This link has been revoked by the patient."}
              {error === 'internal_error' && "An error occurred while loading the medical vault. Please contact support if this issue persists."}
            </p>
          </div>

          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              If you need access to this medical record, please contact the patient directly to request a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pdfUrl) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Medical Vault</h1>
              <p className="text-sm text-muted-foreground">VitaLuxe Services - Shared Record</p>
            </div>
            <Button
              onClick={() => {
                const link = document.createElement('a');
                link.href = pdfUrl;
                link.download = 'medical-vault.pdf';
                link.click();
              }}
            >
              Download PDF
            </Button>
          </div>
        </div>
        <div className="w-full h-[calc(100vh-73px)]">
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Medical Vault PDF"
          />
        </div>
      </div>
    );
  }

  return null;
}
