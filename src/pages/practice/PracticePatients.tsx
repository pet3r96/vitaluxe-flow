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
  const { data: patientsWithStatus = [], isLoading } = useQuery({
    queryKey: ['patients-with-portal-status', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('v_patients_with_portal_status')
        .select('*')
        .eq('practice_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Filter patients
  const filteredPatients = patientsWithStatus.filter(patient =>
    patient.name.toLowerCase().includes(search.toLowerCase())
  );

  // Get patients without portal access
  const patientsWithoutPortal = filteredPatients.filter(p => !p.has_portal_access);

  // Invite individual patient mutation
  const invitePatientMutation = useMutation({
    mutationFn: async (patientId: string) => {
      // Create portal account
      const { data: accountData, error: accountError } = await supabase.functions.invoke(
        'create-patient-portal-account',
        { body: { patientId } }
      );

      if (accountError) {
        console.error('[Patient Portal] Edge function invocation error:', accountError);
        throw accountError;
      }

      if (accountData?.error) {
        console.error('[Patient Portal] Function returned error:', accountData);
        throw new Error(accountData.error);
      }

      // Get patient details
      const { data: patient } = await supabase
        .from('patients')
        .select('name, email, practice_id')
        .eq('id', patientId)
        .single();

      if (!patient) throw new Error('Patient not found');

      // Send welcome email
      const { data: emailData, error: emailError } = await supabase.functions.invoke(
        'send-patient-welcome-email',
        {
          body: {
            userId: accountData.userId,
            email: patient.email,
            name: patient.name,
            token: accountData.token,
            practiceId: patient.practice_id,
          },
        }
      );

      if (emailError) throw emailError;

      return { accountData, emailData };
    },
    onSuccess: () => {
      toast.success('Welcome email sent successfully');
      queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
    },
    onError: (error: any) => {
      toast.error('Failed to invite patient', {
        description: error.message,
      });
    },
  });

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="text-muted-foreground mt-1">
            Manage patient records and portal access
          </p>
        </div>
        {patientsWithoutPortal.length > 0 && (
          <Button
            onClick={() => setBulkInviteDialogOpen(true)}
            className="gap-2"
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
          className="pl-10"
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
          {filteredPatients.map(patient => (
            <Card key={patient.patient_id} className="p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-lg">{patient.name}</h3>
                    <PatientPortalStatusBadge
                      hasPortalAccount={patient.has_portal_access}
                      status={patient.portal_status as 'active' | 'invited' | null}
                      lastLoginAt={patient.last_login_at}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    {patient.email}
                  </div>
                </div>

                <div className="flex gap-2">
                  {!patient.has_portal_access ? (
                    <Button
                      size="sm"
                      onClick={() => invitePatientMutation.mutate(patient.patient_id)}
                      disabled={invitePatientMutation.isPending}
                      className="gap-2"
                    >
                      <Send className="w-3 h-3" />
                      Invite to Portal
                    </Button>
                  ) : patient.portal_status === 'invited' && !patient.last_login_at ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => invitePatientMutation.mutate(patient.patient_id)}
                      disabled={invitePatientMutation.isPending}
                      className="gap-2"
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
        patientIds={patientsWithoutPortal.map(p => p.patient_id)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['patients-with-portal-status'] });
        }}
      />
    </div>
  );
}
