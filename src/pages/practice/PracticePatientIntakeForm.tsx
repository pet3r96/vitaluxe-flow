import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import PatientIntakeForm from "@/pages/patient/PatientIntakeForm";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Practice user wrapper for patient intake form
 * Allows doctors, staff, and providers to complete intake on behalf of patients
 */
export default function PracticePatientIntakeForm() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { user, effectiveRole, effectivePracticeId } = useAuth();

  // Fetch patient account to validate access and check intake status
  const { data: patient, isLoading, error } = useQuery({
    queryKey: ['patient-intake-validation', patientId],
    queryFn: async () => {
      if (!patientId) throw new Error('No patient ID provided');
      
      const { data, error } = await supabase
        .from('patient_accounts')
        .select('*')
        .eq('id', patientId)
        .single();

      if (error) throw error;
      return data as any;
    },
    enabled: !!patientId,
  });

  // Validate access: practice user must belong to same practice as patient
  useEffect(() => {
    if (!isLoading && patient) {
      // Check if user's practice matches patient's practice
      if (effectivePracticeId !== patient.practice_id) {
        console.error('[PracticeIntakeForm] Access denied: practice mismatch');
        navigate('/patients', { replace: true });
        return;
      }
    }
  }, [patient, isLoading, effectivePracticeId, navigate]);

  // Check if user is authorized (not a patient role)
  const isAuthorized = effectiveRole && ['doctor', 'staff', 'provider', 'admin'].includes(effectiveRole);

  if (!isAuthorized) {
    return (
      <div className="container max-w-4xl mx-auto p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access this page. Only practice staff can complete intake forms on behalf of patients.
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => navigate('/patients')}
          className="mt-4"
          variant="outline"
        >
          Back to Patients
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading patient information...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="container max-w-4xl mx-auto p-4 md:p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Unable to load patient information. Please try again or contact support.
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => navigate('/patients')}
          className="mt-4"
          variant="outline"
        >
          Back to Patients
        </Button>
      </div>
    );
  }

  // Show warning if intake already completed
  if (patient.intake_completed_at) {
    return (
      <div className="container max-w-4xl mx-auto p-4 md:p-6">
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This patient's intake form has already been completed by {patient.intake_completed_by_role || 'someone'}.
                Proceeding will overwrite the existing intake data.
              </AlertDescription>
            </Alert>
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => navigate(`/patients/${patientId}`)}
                variant="outline"
              >
                Back to Patient Details
              </Button>
              <Button
                onClick={() => {
                  // Allow them to proceed anyway
                  window.location.reload();
                }}
              >
                Continue Anyway
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the actual intake form with practice context
  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-6 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h1 className="text-2xl font-bold mb-2">Complete Patient Intake Form</h1>
        <p className="text-muted-foreground">
          You are completing this intake form on behalf of the patient as a {effectiveRole}.
          The form data will be saved to this patient's medical vault.
        </p>
      </div>
      
      <PatientIntakeForm targetPatientAccountId={patientId} />
      
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>After completing the form, you'll be redirected back to the patient detail page.</p>
      </div>
    </div>
  );
}
