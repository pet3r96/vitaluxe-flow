import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Mail, Phone, UserPlus, Send } from "lucide-react";
import { PatientPortalStatusBadge } from "@/components/patients/PatientPortalStatusBadge";
import { PatientInvitationDialog } from "@/components/patients/PatientInvitationDialog";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function PracticePatients() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [bulkInviteDialogOpen, setBulkInviteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch patients with portal status
  const { data: rawPatients = [], isLoading } = useQuery({
    queryKey: ['patients-with-portal-status', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('v_patients_with_portal_status')
        .select('*')
        .eq('practice_id', user.id)
        .order('first_name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Add computed name field for display
  // Type cast since TypeScript types haven't regenerated after migration
  const patientsWithStatus = rawPatients.map((p: any) => ({
    ...p,
    name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email
  }));

  // Filter patients
  const filteredPatients = patientsWithStatus.filter((patient: any) =>
    patient.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get patients without portal access
  const patientsWithoutPortal = filteredPatients.filter((p: any) => !p.has_portal_account);

  // Invite individual patient mutation
  const invitePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      console.log('[PracticePatients] Inviting patient:', { patientId });
      
      // Invalidate any cached patient data to ensure fresh data
      await queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
      await queryClient.invalidateQueries({ queryKey: ['patient-accounts'] });
      
      // Small delay to ensure cache is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Create portal account
      const { data: accountData, error: accountError } = await supabase.functions.invoke(
        'create-patient-portal-account',
        { body: { patientId } }
      );

      console.log('[PracticePatients] Account creation response:', { 
        success: !accountError, 
        error: accountError,
        data: accountData 
      });

      if (accountError) {
        console.error('[Patient Portal] Edge function invocation error:', accountError);
        const errorMessage = accountError.message || 'Failed to create portal account';
        throw new Error(errorMessage);
      }

      if (!accountData?.success) {
        console.error('[Patient Portal] Function returned error:', accountData);
        throw new Error(accountData?.error || 'Failed to create portal account');
      }

      // Get patient details
      const { data: patient } = await supabase
        .from('patient_accounts')
        .select('first_name, last_name, email, practice_id')
        .eq('id', patientId)
        .single();

      if (!patient) throw new Error('Patient not found');

      const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || patient.email;

      // Send welcome email (works for both new and re-invited patients)
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        'send-patient-welcome-email',
        {
          body: {
            userId: accountData.userId,
            email: patient.email.toLowerCase(),
            name: patientName,
            token: accountData.token,
            practiceId: patient.practice_id,
          },
        }
      );

      if (emailError) {
        console.error('[Patient Portal] Email error:', emailError);
        throw emailError;
      }

      return { accountData, emailData };
    },
    onSuccess: (data) => {
      const message = data.accountData.alreadyHadAccount 
        ? 'Portal invitation re-sent successfully'
        : 'Welcome email sent successfully';
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
    },
    onError: (error: Error) => {
      console.error('[PracticePatients] Failed to invite patient:', error);
      
      // Provide specific error guidance
      let errorMessage = 'Failed to invite patient to portal';
      let errorDescription = error.message;
      
      if (error.message.includes('No practice context') || error.message.includes('no_practice_context')) {
        errorMessage = 'Unable to determine practice context';
        errorDescription = 'Please try refreshing the page. If impersonating, please exit and re-enter impersonation mode.';
      } else if (error.message.includes('not found')) {
        errorMessage = 'Patient not found';
        errorDescription = 'The patient may have been deleted. Please refresh the page.';
      } else if (error.message.includes('not associated with a practice')) {
        errorMessage = 'Patient has no practice association';
        errorDescription = 'This patient needs to be associated with a practice first.';
      }
      
      toast.error(errorMessage, {
        description: errorDescription
      });
    },
  });

  return (
    <div className="patient-container">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="text-center sm:text-left w-full sm:w-auto">
          <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">Patients</h1>
          <p className="text-muted-foreground mt-1">
            Manage patient records and portal access
          </p>
        </div>
        {patientsWithoutPortal.length > 0 && (
          <Button
            onClick={() => setBulkInviteDialogOpen(true)}
            className="gap-2 w-full sm:w-auto touch-target"
          >
            <UserPlus className="w-4 h-4" />
            Invite All ({patientsWithoutPortal.length})
          </Button>
        )}
      </div>

      <div className="mb-6 relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search patients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 touch-target"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading patients...</div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {search ? 'No patients found matching your search' : 'No patients yet'}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredPatients.map((patient: any) => (
            <Card key={patient.id} className="patient-card p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1 space-y-2 w-full">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="font-semibold text-base sm:text-lg">{patient.name}</h3>
                    <PatientPortalStatusBadge
                      hasPortalAccount={patient.has_portal_account}
                      status={patient.status as 'active' | 'invited' | null}
                      lastLoginAt={patient.last_login_at}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span className="break-all">{patient.email}</span>
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  {!patient.has_portal_account ? (
                    <Button
                      size="sm"
                      onClick={() => invitePatientMutation.mutate(patient.id)}
                      disabled={invitePatientMutation.isPending}
                      className="gap-2 flex-1 sm:flex-none touch-target-sm"
                    >
                      <Send className="w-3 h-3" />
                      Invite to Portal
                    </Button>
                  ) : patient.status === 'invited' && !patient.last_login_at ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => invitePatientMutation.mutate(patient.id)}
                      disabled={invitePatientMutation.isPending}
                      className="gap-2 flex-1 sm:flex-none touch-target-sm"
                    >
                      <Mail className="w-3 h-3" />
                      Resend Email
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PatientInvitationDialog
        open={bulkInviteDialogOpen}
        onOpenChange={setBulkInviteDialogOpen}
        patientIds={patientsWithoutPortal.map((p: any) => p.id)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
        }}
      />
    </div>
  );
}
